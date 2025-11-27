// ============================================
// WA Sender Pro v2.3 - Content Script
// Handles WhatsApp Web DOM interactions
// With i18n support + Attachment Support
// ============================================

// --- i18n Helper ---
function i18n(key) {
  return chrome.i18n.getMessage(key) || key;
}

// --- Debug Mode ---
const DEBUG = true;
function debugLog(msg, data = null) {
  if (DEBUG) {
    console.log(`[WA Sender Pro] ${msg}`, data || '');
  }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'content') {
    return false;
  }

  switch (message.action) {
    case 'ping':
      sendResponse({ connected: isWhatsAppReady() });
      break;

    case 'sendMessage':
      handleSendMessage(message)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'scrapeGroup':
      handleScrapeGroup()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return false;
});

// --- Check if WhatsApp is loaded ---
function isWhatsAppReady() {
  // Check for main WhatsApp elements
  const app = document.querySelector('#app');
  const main = document.querySelector('div[data-testid="chat-list"]') || 
               document.querySelector('div[aria-label="Lista de chats"]') ||
               document.querySelector('div[role="application"]');
  return !!(app && main);
}

// --- Send Message Handler (ROBUSTO) ---
async function handleSendMessage(data) {
  const { phone, text, attachment, sendAttachmentFirst = true } = data;
  const MAX_RETRIES = 2;
  
  // Validación inicial del número
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone || cleanPhone.length < 10) {
    debugLog('❌ Número muy corto o vacío:', phone);
    return { success: false, error: 'Número inválido (muy corto)', skipped: true };
  }
  
  if (cleanPhone.length > 15) {
    debugLog('❌ Número muy largo:', phone);
    return { success: false, error: 'Número inválido (muy largo)', skipped: true };
  }

  try {
    debugLog('📤 ═══════════════════════════════════');
    debugLog('📤 Enviando a:', cleanPhone);
    
    // 1. Navegar al chat
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // 2. Esperar que cargue el chat (con detección de errores)
    try {
      await waitForChatLoad(12000); // 12 segundos máximo
    } catch (loadError) {
      debugLog('❌ Error cargando chat:', loadError.message);
      // Limpiar estado y reportar error
      await tryCloseAnyPopup();
      await sleep(500);
      return { success: false, error: loadError.message, skipped: true };
    }

    // 3. Pequeña pausa de estabilidad
    await sleep(800);
    
    // 4. Verificar una vez más que no hay popup de error
    const errorCheck = await detectAndCloseErrorPopup();
    if (errorCheck) {
      debugLog('❌ Error detectado después de cargar:', errorCheck);
      return { success: false, error: errorCheck, skipped: true };
    }

    // 5. ENVIAR CONTENIDO
    let textSent = false;
    let attachmentSent = false;
    
    if (attachment && attachment.data) {
      debugLog('📎 Tiene adjunto, orden:', sendAttachmentFirst ? 'Adjunto→Texto' : 'Texto→Adjunto');
      
      if (sendAttachmentFirst) {
        // ORDEN: Adjunto → Texto
        try {
          await sendAttachmentToChat(attachment);
          attachmentSent = true;
          await sleep(1500);
        } catch (attachError) {
          debugLog('⚠️ Adjunto falló:', attachError.message);
          // Verificar si el error cerró el chat
          const stillInChat = document.querySelector('div[contenteditable="true"]');
          if (!stillInChat) {
            // El chat se cerró, no podemos continuar
            return { success: false, error: 'Adjunto falló: ' + attachError.message };
          }
        }
        
        // Enviar texto
        if (text && text.trim()) {
          try {
            await sendTextToChat(text);
            textSent = true;
          } catch (textError) {
            debugLog('⚠️ Texto falló:', textError.message);
          }
        }
      } else {
        // ORDEN: Texto → Adjunto
        if (text && text.trim()) {
          try {
            await sendTextToChat(text);
            textSent = true;
            await sleep(1000);
          } catch (textError) {
            debugLog('⚠️ Texto falló:', textError.message);
          }
        }
        
        try {
          await sendAttachmentToChat(attachment);
          attachmentSent = true;
        } catch (attachError) {
          debugLog('⚠️ Adjunto falló:', attachError.message);
        }
      }
      
      // Éxito si al menos uno se envió
      const success = textSent || attachmentSent;
      debugLog(success ? '✅ Mensaje enviado' : '❌ Nada enviado');
      return { 
        success, 
        error: success ? null : 'No se pudo enviar nada',
        textSent,
        attachmentSent
      };
      
    } else {
      // Solo texto
      debugLog('💬 Solo texto');
      if (text && text.trim()) {
        try {
          await sendTextToChat(text);
          textSent = true;
          debugLog('✅ Texto enviado correctamente');
        } catch (textError) {
          debugLog('❌ Error enviando texto:', textError.message);
          return { success: false, error: textError.message };
        }
      } else {
        debugLog('⚠️ No hay texto para enviar');
        return { success: false, error: 'No hay mensaje', skipped: true };
      }
    }

    await sleep(800);
    return { success: textSent, textSent, attachmentSent };

  } catch (error) {
    console.error('[WA Sender Pro] Error general:', error);
    
    // Intentar recuperar el estado
    await tryCloseAnyPopup();
    
    return { success: false, error: error.message };
  }
}

// --- Enviar texto al chat ---
async function sendTextToChat(text) {
  debugLog('💬 Iniciando envío de texto...');
  debugLog('💬 Texto a enviar:', text.substring(0, 50) + '...');
  
  // Intentar múltiples selectores para la caja de texto
  const selectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][role="textbox"]',
    '#main footer div[contenteditable="true"]',
    'footer div[contenteditable="true"]',
    'div[class*="lexical-rich-text-input"]',
    'p.selectable-text[data-lexical-text="true"]'
  ];

  let messageBox = null;
  for (const selector of selectors) {
    messageBox = document.querySelector(selector);
    if (messageBox) {
      debugLog('💬 Caja de texto encontrada con:', selector);
      break;
    }
  }
  
  if (!messageBox) {
    debugLog('❌ No se encontró caja de texto');
    throw new Error(i18n('errorNoMessageBox') || 'No se encontró cuadro de mensaje');
  }
  
  // Focus agresivo
  messageBox.focus();
  messageBox.click();
  await sleep(300);
  
  debugLog('💬 Escribiendo texto...');
  
  // Escribir usando execCommand (método más compatible)
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      document.execCommand('insertText', false, lines[i]);
    }
    
    if (i < lines.length - 1) {
      document.execCommand('insertLineBreak');
    }
  }
  
  // CRÍTICO: Disparar evento de input para que React detecte el cambio
  messageBox.dispatchEvent(new Event('input', { bubbles: true }));
  messageBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  
  debugLog('💬 Texto insertado, esperando botón enviar...');
  await sleep(800);
  
  // Click en botón enviar
  await clickSendButton();
  debugLog('✅ Texto enviado correctamente');
}

// --- Enviar adjunto al chat ---
async function sendAttachmentToChat(attachment) {
  debugLog('📎 Iniciando envío de adjunto:', attachment.name);
  debugLog('📎 Tipo:', attachment.type, 'Tamaño data:', attachment.data ? attachment.data.length : 0);
  
  // 1. Buscar botón de adjuntar - MÚLTIPLES MÉTODOS
  let clipButton = null;
  
  // Método 1: Selectores directos por data-icon (más común)
  const iconSelectors = [
    'span[data-icon="plus"]',
    'span[data-icon="clip"]', 
    'span[data-icon="attach-menu-plus"]',
    'span[data-icon="ptt"]', // A veces está junto al mic
  ];
  
  for (const sel of iconSelectors) {
    clipButton = document.querySelector(sel);
    if (clipButton) {
      debugLog('📎 Encontrado por data-icon:', sel);
      break;
    }
  }
  
  // Método 2: Buscar por aria-label
  if (!clipButton) {
    const ariaLabels = ['Adjuntar', 'Attach', 'Anexar', 'Adjuntar archivo'];
    for (const label of ariaLabels) {
      clipButton = document.querySelector(`[aria-label="${label}"]`) ||
                   document.querySelector(`button[aria-label="${label}"]`) ||
                   document.querySelector(`div[aria-label="${label}"]`);
      if (clipButton) {
        debugLog('📎 Encontrado por aria-label:', label);
        break;
      }
    }
  }
  
  // Método 3: Buscar por title
  if (!clipButton) {
    const titles = ['Adjuntar', 'Attach', 'Anexar'];
    for (const title of titles) {
      clipButton = document.querySelector(`[title="${title}"]`) ||
                   document.querySelector(`button[title="${title}"]`);
      if (clipButton) {
        debugLog('📎 Encontrado por title:', title);
        break;
      }
    }
  }
  
  // Método 4: Buscar en el footer del chat por posición
  if (!clipButton) {
    debugLog('📎 Buscando en footer del chat...');
    const footer = document.querySelector('#main footer') || 
                   document.querySelector('footer') ||
                   document.querySelector('[data-testid="conversation-compose-box-input"]')?.closest('footer');
    
    if (footer) {
      // El botón de adjuntar suele ser el primer o segundo botón en el footer
      const buttons = footer.querySelectorAll('div[role="button"], button');
      debugLog('📎 Botones en footer:', buttons.length);
      
      for (const btn of buttons) {
        const svg = btn.querySelector('svg');
        const span = btn.querySelector('span[data-icon]');
        if (svg || span) {
          // Verificar que no sea el botón de emoji o mic
          const icon = span?.getAttribute('data-icon') || '';
          if (!icon.includes('emoji') && !icon.includes('mic') && !icon.includes('ptt')) {
            clipButton = btn;
            debugLog('📎 Encontrado botón en footer');
            break;
          }
        }
      }
    }
  }
  
  // Método 5: Buscar cualquier SVG de clip en la página
  if (!clipButton) {
    debugLog('📎 Buscando por SVG path...');
    const allButtons = document.querySelectorAll('div[role="button"], button');
    for (const btn of allButtons) {
      const path = btn.querySelector('path');
      if (path) {
        const d = path.getAttribute('d') || '';
        // El icono de clip suele tener ciertas características en su path
        if (d.includes('M16.5') || d.includes('clip') || d.includes('attach')) {
          clipButton = btn;
          debugLog('📎 Encontrado por SVG path');
          break;
        }
      }
    }
  }
  
  if (!clipButton) {
    // Log de diagnóstico: mostrar qué hay en el footer
    const footer = document.querySelector('#main footer, footer');
    if (footer) {
      debugLog('📎 DEBUG - HTML del footer:', footer.innerHTML.substring(0, 500));
    }
    debugLog('❌ No se encontró ningún botón de adjuntar después de todos los métodos');
    throw new Error(i18n('errorNoAttachButton') || 'Botón de adjuntar no encontrado');
  }
  
  // Click en el elemento (o su padre si es necesario)
  const clickTarget = clipButton.closest('div[role="button"]') || 
                      clipButton.closest('button') ||
                      clipButton;
  debugLog('📎 Haciendo click en botón adjuntar...');
  clickTarget.click();
  
  await sleep(1000); // Más tiempo para que aparezca el menú
  
  // 2. Buscar input de archivo
  // WhatsApp crea inputs ocultos al abrir el menú. Buscamos el correcto.
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  debugLog('📎 Inputs de archivo encontrados:', fileInputs.length);
  
  // Log de cada input para debug
  fileInputs.forEach((inp, idx) => {
    debugLog(`📎 Input #${idx}: accept="${inp.accept}"`);
  });
  
  let fileInput = null;
  
  // Prioridad 1: Input que acepte el tipo correcto
  if (attachment.type.startsWith('image/')) {
    fileInput = fileInputs.find(i => i.accept && i.accept.includes('image'));
    if (fileInput) debugLog('📎 Usando input de imágenes');
  } else if (attachment.type.startsWith('video/')) {
    fileInput = fileInputs.find(i => i.accept && i.accept.includes('video'));
    if (fileInput) debugLog('📎 Usando input de videos');
  }
  
  // Prioridad 2: Cualquier input visible o recién creado (el último)
  if (!fileInput && fileInputs.length > 0) {
    fileInput = fileInputs[fileInputs.length - 1];
    debugLog('📎 Usando último input disponible');
  }
  
  if (!fileInput) {
    // Intentar cerrar el menú si falló
    debugLog('❌ No se encontró ningún input de archivo');
    document.body.click();
    throw new Error(i18n('errorNoFileInput') || 'Input de archivo no encontrado');
  }
  
  // 3. Asignar archivo
  try {
    debugLog('📎 Convirtiendo base64 a File...');
    const file = await base64ToFile(attachment.data, attachment.name, attachment.type);
    debugLog('📎 File creado:', file.name, file.size, 'bytes');
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    debugLog('📎 Archivo asignado al input');
    
    // 4. Disparar eventos de cambio
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    debugLog('📎 Eventos change/input disparados');
  } catch (e) {
    console.error("❌ Error preparando archivo:", e);
    document.body.click(); // Cerrar menú
    throw e;
  }
  
  // 5. Esperar modal de vista previa
  debugLog('📎 Esperando modal de preview...');
  
  const modalSelectors = [
    '[data-testid="send"]',
    'span[data-icon="send"]',
    'div[role="button"][aria-label="Send"]',
    'div[role="button"][aria-label="Enviar"]'
  ];
  
  let sendInModal = null;
  let attempts = 0;
  while (!sendInModal && attempts < 20) { // 10 segundos máx
    await sleep(500);
    
    for (const sel of modalSelectors) {
        const els = document.querySelectorAll(sel);
        for (let i = els.length - 1; i >= 0; i--) {
            if (els[i].offsetParent !== null) { // Es visible
                sendInModal = els[i];
                break;
            }
        }
        if (sendInModal) break;
    }
    attempts++;
    if (attempts % 4 === 0) {
      debugLog('📎 Aún esperando modal... intento', attempts);
    }
  }
  
  if (!sendInModal) {
    debugLog('❌ Modal de preview nunca apareció después de', attempts, 'intentos');
    throw new Error(i18n('errorNoSendModal') || 'Modal de envío no apareció (timeout)');
  }
  
  debugLog('📎 Modal encontrado, enviando...');
  await sleep(500);
  
  // 6. Click en enviar
  const sendParent = sendInModal.closest('div[role="button"]') || sendInModal.closest('button') || sendInModal;
  sendParent.click();
  debugLog('📎 Click en botón enviar del modal');
  
  // 7. Esperar a que se cierre el modal/envíe
  await sleep(2000);
  debugLog('✅ Adjunto enviado correctamente');
}

// --- Helper: Click botón enviar principal ---
async function clickSendButton() {
  const selectors = [
    'button[aria-label="Send"]',
    'button[aria-label="Enviar"]',
    'span[data-icon="send"]',
    '#main footer button' // Fallback genérico en footer
  ];
  
  let sendBtn = null;
  for (const selector of selectors) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      if (el.offsetParent !== null) { // Visible
        // Verificar que sea el botón de enviar y no el de microfono (que cambia dinámicamente)
        const icon = el.querySelector('span[data-icon="send"]');
        if (icon || el.getAttribute('aria-label') === 'Send' || el.getAttribute('aria-label') === 'Enviar') {
            sendBtn = el;
            break;
        }
      }
    }
    if (sendBtn) break;
  }
  
  if (sendBtn) {
    sendBtn.click();
    return true;
  }
  
  // Fallback: Enter en la caja de texto
  const messageBox = document.querySelector('div[contenteditable="true"][data-tab="10"]');
  if (messageBox) {
    messageBox.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
    });
    messageBox.dispatchEvent(event);
    return true;
  }
  
  throw new Error(i18n('errorNoSendButton') || 'Botón de enviar no encontrado');
}

// --- Convertir base64 a File object ---
async function base64ToFile(base64Data, filename, mimeType) {
  // Remover prefix si existe
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  
  // Convertir a blob
  const byteString = atob(base64);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([arrayBuffer], { type: mimeType });
  
  // Crear File desde Blob
  return new File([blob], filename, { type: mimeType, lastModified: Date.now() });
}

// --- Wait for Chat to Load (con detección de errores) ---
function waitForChatLoad(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkInterval = setInterval(async () => {
      // ============================================
      // PRIMERO: Detectar y cerrar CUALQUIER popup de error
      // ============================================
      const errorDetected = await detectAndCloseErrorPopup();
      if (errorDetected) {
        clearInterval(checkInterval);
        reject(new Error(errorDetected));
        return;
      }

      // ============================================
      // SEGUNDO: Verificar si el chat cargó correctamente
      // ============================================
      const inputBox = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                       document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                       document.querySelector('footer div[contenteditable="true"]');
                       
      const clipBtn = document.querySelector('span[data-icon="plus"]') || 
                      document.querySelector('span[data-icon="clip"]');

      if (inputBox || clipBtn) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }

      // ============================================
      // TERCERO: Timeout - evitar loop infinito
      // ============================================
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        // Intentar cerrar cualquier cosa abierta
        await tryCloseAnyPopup();
        reject(new Error('Timeout: El chat no cargó'));
      }
    }, 400);
  });
}

// ============================================
// DETECTOR DE ERRORES AUTOMÁTICO
// ============================================
async function detectAndCloseErrorPopup() {
  const bodyText = document.body.innerText.toLowerCase();
  
  // Lista de errores conocidos de WhatsApp
  const errorPatterns = [
    // Número inválido
    { pattern: 'phone number shared via url is invalid', error: 'Número inválido (formato incorrecto)' },
    { pattern: 'el número de teléfono compartido', error: 'Número inválido' },
    { pattern: 'número de teléfono es inválido', error: 'Número inválido' },
    { pattern: 'número no válido', error: 'Número no válido' },
    
    // No está en WhatsApp
    { pattern: 'isn\'t on whatsapp', error: 'No tiene WhatsApp' },
    { pattern: 'no está en whatsapp', error: 'No tiene WhatsApp' },
    { pattern: 'no tiene whatsapp', error: 'No tiene WhatsApp' },
    { pattern: 'not on whatsapp', error: 'No tiene WhatsApp' },
    
    // Cuenta no existe
    { pattern: 'this account does not exist', error: 'Cuenta no existe' },
    { pattern: 'esta cuenta no existe', error: 'Cuenta no existe' },
    
    // Bloqueado o no disponible
    { pattern: 'you can\'t send messages to this contact', error: 'No puedes enviar a este contacto' },
    { pattern: 'no puedes enviar mensajes', error: 'No puedes enviar a este contacto' },
    
    // Error de conexión
    { pattern: 'couldn\'t send', error: 'Error de conexión' },
    { pattern: 'no se pudo enviar', error: 'Error de envío' },
    
    // Número muy largo o corto
    { pattern: 'enter a valid phone', error: 'Número inválido' },
    { pattern: 'ingresa un número válido', error: 'Número inválido' },
  ];
  
  // Buscar si algún patrón coincide
  for (const { pattern, error } of errorPatterns) {
    if (bodyText.includes(pattern)) {
      debugLog(`⚠️ Error detectado: ${error}`);
      
      // Intentar cerrar el popup
      await tryCloseAnyPopup();
      
      return error;
    }
  }
  
  // Buscar popups genéricos de error
  const popup = document.querySelector('[data-testid="popup"]') ||
                document.querySelector('[role="dialog"]') ||
                document.querySelector('.popup');
  
  if (popup) {
    const popupText = popup.innerText.toLowerCase();
    // Verificar si es un popup de error (no el de media preview)
    if (popupText.includes('error') || popupText.includes('invalid') || 
        popupText.includes('inválido') || popupText.includes('couldn\'t')) {
      debugLog('⚠️ Popup de error genérico detectado');
      await tryCloseAnyPopup();
      return 'Error desconocido';
    }
  }
  
  return null; // No hay error
}

// ============================================
// CERRAR CUALQUIER POPUP
// ============================================
async function tryCloseAnyPopup() {
  debugLog('🔄 Intentando cerrar popups...');
  
  // Lista de botones de cierre comunes
  const closeSelectors = [
    '[data-testid="popup-controls-ok"]',
    '[data-testid="popup-controls-cancel"]',
    'button[aria-label="OK"]',
    'button[aria-label="Aceptar"]',
    'button[aria-label="Close"]',
    'button[aria-label="Cerrar"]',
    '[role="dialog"] button',
    '.popup-controls button',
    'div[role="button"]:has(span)',
    // Botón X de cerrar
    '[data-testid="x"]',
    '[aria-label="Close"]',
  ];
  
  for (const selector of closeSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) { // Visible
        btn.click();
        debugLog('🔄 Popup cerrado con:', selector);
        await sleep(300);
        return true;
      }
    } catch (e) {
      // Ignorar errores
    }
  }
  
  // Fallback: Presionar Escape
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  await sleep(200);
  
  // Fallback: Click en el body para cerrar
  document.body.click();
  await sleep(200);
  
  return false;
}

// --- Scrape Group Members (Enhanced) ---
async function handleScrapeGroup() {
  try {
    const members = [];
    const seenNumbers = new Set();

    console.log('[WA Sender Pro] Iniciando extracción de miembros del grupo...');

    // Verificar si estamos en la vista de info del grupo
    const groupInfoPanel = document.querySelector('[data-testid="group-info-drawer"]') ||
                           document.querySelector('[data-testid="contact-info-drawer"]') ||
                           document.querySelector('div[data-animate-drawer-content="true"]');

    if (!groupInfoPanel) {
      console.log('[WA Sender Pro] Panel de info no encontrado, buscando en la página completa...');
    }

    // Método 1: Buscar en elementos de participantes con data-testid
    const participantSelectors = [
      '[data-testid="cell-frame-container"]',
      '[data-testid="contact-info-drawer"] [role="listitem"]',
      '[data-testid="group-info-participants-section"] [role="listitem"]',
      'div[data-testid="conversation-panel-body"] [role="listitem"]'
    ];

    for (const selector of participantSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        extractPhoneFromElement(el, members, seenNumbers);
      });
    }

    // Método 2: Buscar spans con título que contenga números
    const spanWithTitle = document.querySelectorAll('span[title*="+"], span[title*="52"], span[title*="1 "]');
    spanWithTitle.forEach(el => {
      const title = el.getAttribute('title') || '';
      extractPhoneFromText(title, members, seenNumbers);
    });

    // Método 3: Buscar en atributos aria-label
    const ariaElements = document.querySelectorAll('[aria-label*="+"], [aria-label*="participante"]');
    ariaElements.forEach(el => {
      const label = el.getAttribute('aria-label') || '';
      extractPhoneFromText(label, members, seenNumbers);
    });

    // Método 4: Buscar texto que parezca número de teléfono en elementos visibles
    const textElements = document.querySelectorAll('span[dir="auto"], span[dir="ltr"]');
    textElements.forEach(el => {
      const text = el.textContent || '';
      // Solo procesar si parece un número de teléfono
      if (/^\+?\d[\d\s\-\(\)]{8,}$/.test(text.trim())) {
        extractPhoneFromText(text, members, seenNumbers);
      }
    });

    // Método 5: Último recurso - buscar patrones de teléfono en todo el texto visible
    if (members.length === 0) {
      console.log('[WA Sender Pro] Usando método de respaldo - análisis de texto completo');
      const visibleText = document.body.innerText;
      
      // Patrones de teléfono comunes
      const patterns = [
        /\+\d{1,3}\s?\d{2,3}\s?\d{3,4}\s?\d{3,4}/g,  // +52 155 1234 5678
        /\+\d{10,15}/g,  // +521551234567
        /\d{2}\s\d{4}\s\d{4}/g,  // 55 1234 5678
      ];

      patterns.forEach(pattern => {
        const matches = visibleText.match(pattern) || [];
        matches.forEach(match => {
          extractPhoneFromText(match, members, seenNumbers);
        });
      });
    }

    console.log(`[WA Sender Pro] Total miembros encontrados: ${members.length}`);

    if (members.length === 0) {
      return { 
        error: i18n('errorNoMembersInstruction'),
        members: [] 
      };
    }

    return { 
      success: true, 
      members: members,
      count: members.length 
    };

  } catch (error) {
    console.error('[WA Sender Pro] Error en scraping:', error);
    return { error: error.message, members: [] };
  }
}

// Función auxiliar para extraer teléfono de un elemento
function extractPhoneFromElement(element, members, seenNumbers) {
  // Buscar en el elemento y sus hijos
  const allText = element.textContent || '';
  const title = element.getAttribute('title') || '';
  
  extractPhoneFromText(allText, members, seenNumbers);
  extractPhoneFromText(title, members, seenNumbers);
  
  // Buscar en spans internos
  const spans = element.querySelectorAll('span[title]');
  spans.forEach(span => {
    const spanTitle = span.getAttribute('title') || '';
    extractPhoneFromText(spanTitle, members, seenNumbers);
  });
}

// Función auxiliar para extraer teléfono de texto
function extractPhoneFromText(text, members, seenNumbers) {
  if (!text) return;
  
  // Limpiar y buscar patrones de teléfono
  const cleaned = text.replace(/[\s\-\(\)\.]/g, '');
  
  // Buscar secuencias de dígitos
  const matches = cleaned.match(/\+?\d{10,15}/g) || [];
  
  matches.forEach(match => {
    let phone = match.replace(/\D/g, '');
    
    // Normalizar código de país
    if (phone.length === 10) {
      phone = '52' + phone; // Asumir México
    }
    
    // Validar longitud
    if (phone.length >= 10 && phone.length <= 15 && !seenNumbers.has(phone)) {
      seenNumbers.add(phone);
      members.push({
        phone: phone,
        raw: match
      });
    }
  });
}

// --- Wait for Element ---
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(check);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(check);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, 200);
  });
}

// --- Utility ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Initialization ---
console.log('[WA Sender Pro] Content script loaded on WhatsApp Web');

// Notify that content script is ready
setTimeout(() => {
  if (isWhatsAppReady()) {
    chrome.runtime.sendMessage({ action: 'contentReady' });
  }
}, 2000);