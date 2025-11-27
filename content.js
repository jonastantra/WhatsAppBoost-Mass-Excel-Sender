// ============================================
// WA Sender Pro v2.0 - Content Script
// Handles WhatsApp Web DOM interactions
// ============================================

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

// --- Send Message Handler ---
async function handleSendMessage(data) {
  const { phone, text, attachment } = data;

  try {
    // 1. Navigate to chat using WhatsApp Web URL API
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text || '')}`;
    
    // Create and click a temporary link
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // 2. Wait for chat to load
    await waitForChatLoad();

    // 3. Small delay for stability
    await sleep(800);

    // 4. Handle attachment if present
    if (attachment) {
      await handleAttachment(attachment);
    }

    // 5. Send the message
    await clickSendButton();

    // 6. Wait for message to be sent
    await sleep(1000);

    return { success: true };

  } catch (error) {
    console.error('[WA Sender Pro] Error sending message:', error);
    return { success: false, error: error.message };
  }
}

// --- Wait for Chat to Load ---
function waitForChatLoad(timeout = 20000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      // Success indicators
      const inputBox = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                       document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                       document.querySelector('footer div[contenteditable="true"]');
      const sendBtn = document.querySelector('span[data-icon="send"]');
      const micBtn = document.querySelector('span[data-icon="mic"]');
      const clipBtn = document.querySelector('span[data-icon="plus"]') || 
                      document.querySelector('span[data-icon="clip"]') ||
                      document.querySelector('span[data-icon="attach-menu-plus"]');

      if (inputBox || sendBtn || micBtn || clipBtn) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }

      // Check for invalid number popup
      const bodyText = document.body.innerText;
      if (bodyText.includes('Phone number shared via url is invalid') ||
          bodyText.includes('El número de teléfono compartido a través de') ||
          bodyText.includes('número de teléfono es inválido')) {
        clearInterval(checkInterval);
        
        // Try to close popup
        const okBtn = document.querySelector('[data-testid="popup-controls-ok"]') ||
                      document.querySelector('div[role="button"]:has(span)');
        if (okBtn) okBtn.click();
        
        reject(new Error('Número inválido'));
        return;
      }

      // Timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout esperando el chat'));
      }
    }, 300);
  });
}

// --- Handle Attachment ---
async function handleAttachment(attachment) {
  try {
    // Click attach button (plus/clip icon)
    const attachBtn = document.querySelector('span[data-icon="plus"]') ||
                      document.querySelector('span[data-icon="clip"]') ||
                      document.querySelector('span[data-icon="attach-menu-plus"]');
    
    if (!attachBtn) {
      throw new Error('No se encontró el botón de adjuntar');
    }

    const attachBtnParent = attachBtn.closest('div[role="button"]') || 
                            attachBtn.closest('button') ||
                            attachBtn.parentElement;
    attachBtnParent.click();

    // Wait for menu to appear
    await sleep(500);

    // Find file input for images/videos/documents
    const fileInputs = document.querySelectorAll('input[type="file"]');
    let targetInput = null;

    for (const input of fileInputs) {
      if (attachment.type.startsWith('image') && input.accept.includes('image')) {
        targetInput = input;
        break;
      }
      if (attachment.type.startsWith('video') && input.accept.includes('video')) {
        targetInput = input;
        break;
      }
      if (!targetInput) {
        targetInput = input;
      }
    }

    if (!targetInput) {
      throw new Error('No se encontró el input de archivo');
    }

    // Note: Direct file injection doesn't work due to security restrictions
    // The user will need to manually select the file
    console.log('[WA Sender Pro] Attachment handling requires manual file selection');

  } catch (error) {
    console.error('[WA Sender Pro] Attachment error:', error);
    // Continue without attachment
  }
}

// --- Click Send Button ---
async function clickSendButton() {
  // Find send button
  const sendBtn = document.querySelector('span[data-icon="send"]');
  
  if (sendBtn) {
    const sendBtnParent = sendBtn.closest('button') || 
                          sendBtn.closest('div[role="button"]') ||
                          sendBtn.parentElement;
    sendBtnParent.click();
    return true;
  }

  // If no send button, try pressing Enter on the input
  const inputBox = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                   document.querySelector('div[contenteditable="true"][role="textbox"]');
  
  if (inputBox) {
    inputBox.focus();
    
    // Dispatch Enter key event
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    });
    inputBox.dispatchEvent(enterEvent);
    return true;
  }

  throw new Error('No se encontró el botón de enviar');
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
        error: 'No se encontraron números. Asegúrate de:\n1. Estar en la vista de info del grupo\n2. Que los participantes sean visibles\n3. Desplázate para cargar más participantes',
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
