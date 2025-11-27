// ============================================
// WA Sender Pro v2.2 - Sidebar Logic
// Sistema Inteligente de Detección de WhatsApp
// Con soporte de internacionalización (i18n)
// ============================================

// --- State ---
let contacts = [];
let templates = [];
let currentAttachment = null;
let isSending = false;
let shouldStop = false;
let whatsappTabId = null;
let isWhatsAppReady = false;

let settings = {
  delayMin: 6,
  delayMax: 10,
  antiBan: false,
  deleteAfter: false,
  addTimestamp: false
};

// --- UI Elements ---
const screens = {
  loading: () => document.getElementById('loading-screen'),
  qr: () => document.getElementById('qr-screen'),
  error: () => document.getElementById('error-screen'),
  main: () => document.getElementById('main-ui')
};

// ============================================
// i18n - Internationalization Helper
// ============================================

/**
 * Get localized message with optional substitutions
 */
function i18n(key, ...substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

/**
 * Apply i18n to all elements with data-i18n attributes
 */
function applyI18n() {
  // data-i18n for text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.textContent = message;
    }
  });

  // data-i18n-html for innerHTML (with HTML tags)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.innerHTML = message;
    }
  });

  // data-i18n-title for title attributes
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.title = message;
    }
  });

  // data-i18n-placeholder for placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.placeholder = message;
    }
  });
}

// ============================================
// Initialization - Sistema de Detección Automática
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply i18n first
  applyI18n();
  
  // Then initialize app
  initializeApp();
});

async function initializeApp() {
  console.log('[WA Sender Pro] Iniciando...');
  
  // Mostrar pantalla de carga
  showScreen('loading');
  updateLoadingStep('find', 'active');
  updateLoadingMessage(i18n('msgSearchingWhatsApp'));
  
  try {
    // Paso 1: Buscar o abrir WhatsApp Web
    const findResult = await chrome.runtime.sendMessage({ action: 'findOrOpenWhatsApp' });
    
    if (!findResult.success) {
      throw new Error(findResult.error || i18n('msgCouldNotFindWhatsApp'));
    }
    
    whatsappTabId = findResult.tabId;
    updateLoadingStep('find', 'done');
    updateLoadingStep('connect', 'active');
    
    if (findResult.wasOpen) {
      updateLoadingMessage(i18n('msgConnectingWhatsApp'));
    } else {
      updateLoadingMessage(i18n('msgWaitingWhatsAppLoad'));
    }
    
    // Paso 2: Esperar a que WhatsApp esté listo
    const ready = await waitForWhatsAppReady(whatsappTabId);
    
    if (ready.success) {
      updateLoadingStep('connect', 'done');
      updateLoadingStep('ready', 'active');
      updateLoadingMessage(i18n('msgConnected'));
      
      // Pequeña pausa para mostrar el estado final
      await sleep(500);
      
      updateLoadingStep('ready', 'done');
      isWhatsAppReady = true;
      
      // Mostrar UI principal
      showScreen('main');
      
      // Cargar datos guardados
      await loadFromStorage();
      
      // Inicializar event listeners
      initEventListeners();
      
      console.log('[WA Sender Pro] Listo para usar');
      
    } else if (ready.status === 'qr_required') {
      // Mostrar pantalla de QR
      showScreen('qr');
      
    } else {
      throw new Error(ready.error || 'WhatsApp Web no pudo cargar');
    }
    
  } catch (error) {
    console.error('[WA Sender Pro] Error de inicialización:', error);
    showError(error.message);
  }
}

/**
 * Esperar a que WhatsApp esté completamente cargado
 */
async function waitForWhatsAppReady(tabId, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkWhatsAppReady',
        tabId: tabId
      });
      
      if (response.ready) {
        return { success: true };
      }
      
      if (response.status === 'qr_required' || response.needsQRScan) {
        return { success: false, status: 'qr_required' };
      }
      
      // Actualizar mensaje de progreso
      const progress = Math.round(((i + 1) / maxRetries) * 100);
      updateLoadingMessage(i18n('msgLoadingWhatsApp', progress.toString()));
      
    } catch (error) {
      console.warn('Error checking WhatsApp ready:', error);
    }
    
    // Esperar 1 segundo antes del siguiente intento
    await sleep(1000);
  }
  
  return { success: false, error: i18n('msgTimeoutExpired') };
}

// ============================================
// Screen Management
// ============================================

function showScreen(screenName) {
  // Ocultar todas las pantallas
  Object.values(screens).forEach(getScreen => {
    const screen = getScreen();
    if (screen) screen.style.display = 'none';
  });
  
  // Mostrar la pantalla solicitada
  const targetScreen = screens[screenName]();
  if (targetScreen) {
    targetScreen.style.display = screenName === 'main' ? 'flex' : 'flex';
    if (screenName === 'main') {
      targetScreen.style.display = 'flex';
      targetScreen.style.flexDirection = 'column';
    }
  }
}

function updateLoadingMessage(message) {
  const el = document.getElementById('loading-message');
  if (el) el.textContent = message;
}

function updateLoadingStep(step, status) {
  const stepEl = document.getElementById(`step-${step}`);
  if (!stepEl) return;
  
  const iconEl = stepEl.querySelector('.was-step-icon');
  
  // Remover clases anteriores
  stepEl.classList.remove('active', 'done');
  
  switch (status) {
    case 'active':
      stepEl.classList.add('active');
      if (iconEl) iconEl.textContent = '◉';
      break;
    case 'done':
      stepEl.classList.add('done');
      if (iconEl) iconEl.textContent = '✓';
      break;
    default:
      if (iconEl) iconEl.textContent = '○';
  }
}

function showError(message) {
  const errorMsg = document.getElementById('error-message');
  if (errorMsg) errorMsg.textContent = message;
  showScreen('error');
  
  // Event listeners para botones de error
  document.getElementById('error-retry-btn')?.addEventListener('click', () => {
    initializeApp();
  });
  
  document.getElementById('error-open-btn')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'findOrOpenWhatsApp' });
    initializeApp();
  });
}

// ============================================
// Tab Navigation
// ============================================

function initTabs() {
  const tabs = document.querySelectorAll('.was-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.was-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  
  document.querySelectorAll('.was-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
  // Tabs
  initTabs();
  
  // QR screen retry
  document.getElementById('qr-retry-btn')?.addEventListener('click', () => {
    initializeApp();
  });
  
  // Manual tab - Add contacts
  document.getElementById('add-number-btn')?.addEventListener('click', addManualContact);
  document.getElementById('number-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addManualContact();
  });
  document.getElementById('clear-contacts-btn')?.addEventListener('click', clearContacts);
  
  // Excel tab - File upload (Enhanced)
  initUploadZone();
  document.getElementById('file-input')?.addEventListener('change', handleFileUpload);
  document.getElementById('download-excel-btn')?.addEventListener('click', downloadExcelTemplate);
  document.getElementById('download-csv-btn')?.addEventListener('click', downloadCSVTemplate);
  document.getElementById('remove-file-btn')?.addEventListener('click', removeUploadedFile);
  document.getElementById('confirm-import-btn')?.addEventListener('click', confirmImport);
  document.getElementById('cancel-import-btn')?.addEventListener('click', cancelImport);
  
  // Groups tab
  document.getElementById('scrape-group-btn')?.addEventListener('click', scrapeGroupMembers);
  document.getElementById('confirm-group-import-btn')?.addEventListener('click', confirmGroupImport);
  document.getElementById('cancel-group-import-btn')?.addEventListener('click', cancelGroupImport);
  
  // Settings tab - Intervals
  document.querySelectorAll('.was-interval-btn').forEach(btn => {
    btn.addEventListener('click', handleIntervalChange);
  });
  document.getElementById('delay-min')?.addEventListener('change', saveSettings);
  document.getElementById('delay-max')?.addEventListener('change', saveSettings);
  document.getElementById('anti-ban-toggle')?.addEventListener('change', saveSettings);
  document.getElementById('delete-after-toggle')?.addEventListener('change', saveSettings);
  document.getElementById('timestamp-toggle')?.addEventListener('change', saveSettings);
  document.getElementById('reset-stats-btn')?.addEventListener('click', resetStats);
  
  // Message composer
  document.getElementById('template-select')?.addEventListener('change', applyTemplate);
  document.getElementById('save-template-btn')?.addEventListener('click', saveTemplate);
  document.getElementById('delete-template-btn')?.addEventListener('click', deleteTemplate);
  
  // Variables
  document.querySelectorAll('.was-variable-btn').forEach(btn => {
    btn.addEventListener('click', () => insertVariable(btn.getAttribute('data-var')));
  });
  
  // Format buttons
  document.querySelectorAll('.was-format-btn').forEach(btn => {
    btn.addEventListener('click', () => insertFormat(btn.getAttribute('data-format')));
  });
  
  // Attachment
  document.getElementById('attachment-input')?.addEventListener('change', handleAttachment);
  document.getElementById('remove-attachment-btn')?.addEventListener('click', removeAttachment);
  
  // Quick actions
  document.getElementById('add-apology-btn')?.addEventListener('click', () => {
    insertText(i18n('apologyText'));
  });
  document.getElementById('add-timestamp-btn')?.addEventListener('click', () => {
    insertText(`\n\n📅 ${new Date().toLocaleString()}`);
  });
  
  // Main actions
  document.getElementById('send-btn')?.addEventListener('click', startSending);
  document.getElementById('stop-btn')?.addEventListener('click', stopSending);
  document.getElementById('test-message-btn')?.addEventListener('click', sendTestMessage);
  document.getElementById('quick-send-btn')?.addEventListener('click', startSending);
  document.getElementById('show-stats-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('tab-settings');
  });
}

// ============================================
// Storage
// ============================================

async function loadFromStorage() {
  try {
    const result = await chrome.storage.local.get(['templates', 'settings', 'stats', 'testNumber']);
    
    if (result.templates) {
      templates = result.templates;
      updateTemplateSelect();
    }
    
    if (result.settings) {
      settings = { ...settings, ...result.settings };
      applySettingsToUI();
    }
    
    if (result.stats) {
      updateStatsDisplay(result.stats);
    }
  } catch (error) {
    console.error('Error loading from storage:', error);
  }
}

async function saveSettings() {
  settings.delayMin = parseInt(document.getElementById('delay-min')?.value) || 6;
  settings.delayMax = parseInt(document.getElementById('delay-max')?.value) || 10;
  settings.antiBan = document.getElementById('anti-ban-toggle')?.checked || false;
  settings.deleteAfter = document.getElementById('delete-after-toggle')?.checked || false;
  settings.addTimestamp = document.getElementById('timestamp-toggle')?.checked || false;
  
  await chrome.storage.local.set({ settings });
}

function applySettingsToUI() {
  const delayMin = document.getElementById('delay-min');
  const delayMax = document.getElementById('delay-max');
  const antiBan = document.getElementById('anti-ban-toggle');
  const deleteAfter = document.getElementById('delete-after-toggle');
  const timestamp = document.getElementById('timestamp-toggle');
  
  if (delayMin) delayMin.value = settings.delayMin;
  if (delayMax) delayMax.value = settings.delayMax;
  if (antiBan) antiBan.checked = settings.antiBan;
  if (deleteAfter) deleteAfter.checked = settings.deleteAfter;
  if (timestamp) timestamp.checked = settings.addTimestamp;
}

// ============================================
// Contact Management
// ============================================

function addManualContact() {
  const input = document.getElementById('number-input');
  if (!input) return;
  
  let number = input.value.trim().replace(/\D/g, '');
  
  if (number.length < 10) {
    showNotification(i18n('msgInvalidNumber'), 'error');
    return;
  }
  
  if (contacts.some(c => c.number === number)) {
    showNotification(i18n('msgNumberAlreadyInList'), 'warning');
    return;
  }
  
  contacts.push({ number, status: 'pending', name: '' });
  input.value = '';
  renderContacts();
  showNotification(i18n('msgNumberAdded', number), 'success');
}

function clearContacts() {
  if (contacts.length === 0) return;
  
  if (confirm(i18n('msgConfirmClearList'))) {
    contacts = [];
    renderContacts();
    showNotification(i18n('msgListCleared'), 'success');
  }
}

function renderContacts() {
  const list = document.getElementById('contact-list');
  const totalSpan = document.getElementById('total-contacts');
  
  if (totalSpan) totalSpan.textContent = contacts.length;
  updatePendingStats();
  
  if (!list) return;
  
  if (contacts.length === 0) {
    list.innerHTML = `
      <div class="was-empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" opacity="0.3">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
        <p>${i18n('noContactsAdded')}</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = contacts.map((c, i) => `
    <div class="was-contact-item ${c.status === 'sending' ? 'sending' : ''}" data-index="${i}">
      <div class="was-contact-number">
        <span class="index">${i + 1}.</span>
        <span>${formatPhoneNumber(c.number)}</span>
      </div>
      <span class="was-status-badge was-status-${c.status}">
        ${getStatusText(c.status)}
      </span>
    </div>
  `).join('');
}

function formatPhoneNumber(number) {
  if (number.length > 10) {
    return `+${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5, 8)} ${number.slice(8)}`;
  }
  return number;
}

function getStatusText(status) {
  const texts = {
    pending: i18n('statusPending'),
    sending: i18n('statusSendingProgress'),
    sent: i18n('statusSent'),
    error: i18n('statusErrorLabel')
  };
  return texts[status] || status;
}

// ============================================
// Excel/CSV Import - Sistema Mejorado
// ============================================

// Estado temporal para importación
let pendingImport = [];

/**
 * Inicializar zona de drag & drop
 */
function initUploadZone() {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const selectBtn = document.getElementById('select-file-btn');
  
  if (!uploadZone || !fileInput) return;
  
  // Click para seleccionar archivo
  selectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  
  uploadZone.addEventListener('click', () => fileInput.click());
  
  // Drag & Drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragging');
  });
  
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragging');
  });
  
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragging');
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload({ target: { files: [file] } });
    }
  });
}

/**
 * Descargar plantilla Excel
 */
function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    showNotification(i18n('msgExcelLibNotLoaded'), 'error');
    return;
  }
  
  const data = [
    ['phone', 'name', 'var1', 'var2', 'var3'],
    ['5215512345678', 'Juan Pérez', 'Producto A', '1500', 'Premium'],
    ['5215587654321', 'María López', 'Producto B', '2000', 'Básico'],
    ['5215598765432', 'Carlos Ruiz', 'Producto C', '1800', 'Premium'],
    ['5215523456789', 'Ana García', 'Producto D', '2500', 'Gold'],
    ['5215534567890', 'Pedro Martínez', 'Producto E', '1200', 'Básico']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 16 }, // phone
    { wch: 20 }, // name
    { wch: 14 }, // var1
    { wch: 10 }, // var2
    { wch: 12 }  // var3
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
  
  XLSX.writeFile(wb, 'WA_Sender_Pro_Template.xlsx');
  showNotification(i18n('msgExcelTemplateDownloaded'), 'success');
}

/**
 * Descargar plantilla CSV
 */
function downloadCSVTemplate() {
  const headers = ['phone', 'name', 'var1', 'var2', 'var3'];
  const examples = [
    ['5215512345678', 'Juan Pérez', 'Producto A', '1500', 'Premium'],
    ['5215587654321', 'María López', 'Producto B', '2000', 'Básico'],
    ['5215598765432', 'Carlos Ruiz', 'Producto C', '1800', 'Premium'],
    ['5215523456789', 'Ana García', 'Producto D', '2500', 'Gold'],
    ['5215534567890', 'Pedro Martínez', 'Producto E', '1200', 'Básico']
  ];
  
  let csv = headers.join(',') + '\n';
  examples.forEach(row => {
    csv += row.join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'WA_Sender_Pro_Template.csv';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  showNotification(i18n('msgCsvTemplateDownloaded'), 'success');
}

/**
 * Manejar subida de archivo
 */
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validar tamaño (máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification(i18n('msgFileTooLarge'), 'error');
    return;
  }
  
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.split('.').pop();
  
  // Mostrar preview del archivo
  showFilePreview(file);
  
  try {
    let parsedData;
    
    if (fileExt === 'xlsx' || fileExt === 'xls') {
      parsedData = await parseExcelAdvanced(file);
    } else if (fileExt === 'csv' || fileExt === 'txt') {
      parsedData = await parseCSVAdvanced(file);
    } else {
      throw new Error(i18n('msgFormatNotSupported'));
    }
    
    if (parsedData.contacts.length === 0) {
      throw new Error(i18n('msgNoValidContacts'));
    }
    
    // Guardar datos pendientes y mostrar preview
    pendingImport = parsedData.contacts;
    showImportPreview(parsedData);
    
  } catch (error) {
    console.error('Error importing file:', error);
    showImportResult(false, error.message);
  }
}

/**
 * Mostrar preview del archivo subido
 */
function showFilePreview(file) {
  const preview = document.getElementById('file-preview');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const fileIcon = document.getElementById('file-icon');
  const uploadZone = document.getElementById('upload-zone');
  
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
  
  // Cambiar icono según tipo
  if (fileIcon) {
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);
    fileIcon.innerHTML = isExcel
      ? '<svg viewBox="0 0 24 24" width="32" height="32"><path fill="#16a34a" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/><path fill="#16a34a" d="M8 12h3v2H8v-2zm0 3h3v2H8v-2zm5-3h3v2h-3v-2zm0 3h3v2h-3v-2z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="32" height="32"><path fill="#3b82f6" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>';
  }
  
  if (uploadZone) uploadZone.style.display = 'none';
  if (preview) preview.style.display = 'flex';
  
  // Ocultar resultado anterior
  const result = document.getElementById('import-result');
  if (result) result.style.display = 'none';
}

/**
 * Parsear Excel con detección inteligente de columnas
 */
async function parseExcelAdvanced(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          reject(new Error(i18n('msgExcelLibNotLoaded')));
          return;
        }
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          reject(new Error(i18n('msgFileEmptyOrNoData')));
          return;
        }
        
        // Detectar headers
        const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
        const phoneCol = findPhoneColumn(headers);
        const nameCol = findNameColumn(headers);
        
        if (phoneCol === -1) {
          reject(new Error(i18n('msgNoPhoneColumn')));
          return;
        }
        
        // Parsear contactos
        const contacts = [];
        const invalid = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[phoneCol]) continue;
          
          const rawPhone = String(row[phoneCol]).trim();
          const cleanPhone = cleanPhoneNumber(rawPhone);
          
          if (validatePhoneNumber(cleanPhone)) {
            contacts.push({
              number: cleanPhone,
              name: nameCol !== -1 && row[nameCol] ? String(row[nameCol]).trim() : '',
              status: 'pending',
              vars: extractVars(headers, row, phoneCol, nameCol)
            });
          } else {
            invalid.push(rawPhone);
          }
        }
        
        resolve({ contacts, invalid, headers });
        
      } catch (err) {
        console.error('Excel parse error:', err);
        reject(new Error(i18n('msgExcelReadError')));
      }
    };
    reader.onerror = () => reject(new Error(i18n('msgFileLoadError')));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parsear CSV con detección inteligente de columnas
 */
async function parseCSVAdvanced(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error(i18n('msgFileEmptyOrNoData')));
          return;
        }
        
        // Detectar delimitador
        const delimiter = detectCSVDelimiter(lines[0]);
        
        // Parsear headers
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        const phoneCol = findPhoneColumn(headers);
        const nameCol = findNameColumn(headers);
        
        if (phoneCol === -1) {
          reject(new Error(i18n('msgNoPhoneColumn')));
          return;
        }
        
        // Parsear contactos
        const contacts = [];
        const invalid = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (!values[phoneCol]) continue;
          
          const rawPhone = values[phoneCol];
          const cleanPhone = cleanPhoneNumber(rawPhone);
          
          if (validatePhoneNumber(cleanPhone)) {
            contacts.push({
              number: cleanPhone,
              name: nameCol !== -1 && values[nameCol] ? values[nameCol] : '',
              status: 'pending',
              vars: extractVars(headers, values, phoneCol, nameCol)
            });
          } else {
            invalid.push(rawPhone);
          }
        }
        
        resolve({ contacts, invalid, headers });
        
      } catch (err) {
        console.error('CSV parse error:', err);
        reject(new Error(i18n('msgCsvReadError')));
      }
    };
    reader.onerror = () => reject(new Error(i18n('msgFileLoadError')));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Funciones auxiliares de validación
 */
function findPhoneColumn(headers) {
  const phoneVariations = ['phone', 'number', 'telefono', 'teléfono', 'whatsapp', 'mobile', 'celular', 'cel', 'movil', 'móvil', 'numero', 'número'];
  return headers.findIndex(h => phoneVariations.includes(h.toLowerCase()));
}

function findNameColumn(headers) {
  const nameVariations = ['name', 'nombre', 'contact', 'contacto', 'client', 'cliente', 'persona'];
  return headers.findIndex(h => nameVariations.includes(h.toLowerCase()));
}

function cleanPhoneNumber(phone) {
  // Remover espacios, guiones, paréntesis, signos de más
  let cleaned = String(phone).replace(/[\s\-\(\)\+\.]/g, '');
  
  // Remover prefijo "00" si existe
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Si tiene 10 dígitos, asumir México (+52)
  if (cleaned.length === 10 && !cleaned.startsWith('52')) {
    cleaned = '52' + cleaned;
  }
  
  return cleaned;
}

function validatePhoneNumber(phone) {
  // Debe tener entre 10 y 15 dígitos
  return /^\d{10,15}$/.test(phone);
}

function detectCSVDelimiter(firstLine) {
  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let maxCount = 0;
  
  delimiters.forEach(d => {
    const count = (firstLine.match(new RegExp('\\' + d, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = d;
    }
  });
  
  return bestDelimiter;
}

function extractVars(headers, row, phoneCol, nameCol) {
  const vars = {};
  headers.forEach((header, index) => {
    if (index !== phoneCol && index !== nameCol && row[index]) {
      vars[header] = String(row[index]);
    }
  });
  return vars;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Mostrar preview de importación
 */
function showImportPreview(data) {
  const previewContainer = document.getElementById('import-preview');
  const previewTable = document.getElementById('preview-table');
  const previewCount = document.getElementById('preview-count');
  
  if (!previewContainer || !previewTable) return;
  
  const { contacts, invalid } = data;
  
  // Actualizar contador
  if (previewCount) {
    previewCount.textContent = i18n('contactsCount', contacts.length.toString());
  }
  
  // Generar filas de preview (máximo 10)
  const previewContacts = contacts.slice(0, 10);
  previewTable.innerHTML = previewContacts.map(c => `
    <div class="was-preview-row">
      <span class="was-preview-phone">${formatPhoneNumber(c.number)}</span>
      <span class="was-preview-name">${c.name || '—'}</span>
      <span class="was-preview-status valid">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </span>
    </div>
  `).join('');
  
  if (contacts.length > 10) {
    previewTable.innerHTML += `
      <div class="was-preview-row" style="justify-content: center; color: var(--was-text-muted);">
        ${i18n('andMoreContacts', (contacts.length - 10).toString())}
      </div>
    `;
  }
  
  // Mostrar advertencia de números inválidos
  if (invalid.length > 0) {
    const result = document.getElementById('import-result');
    if (result) {
      result.className = 'was-import-result';
      result.style.background = '#fef3c7';
      result.style.color = '#92400e';
      result.style.border = '1px solid #fcd34d';
      result.innerHTML = i18n('msgInvalidNumbersOmitted', invalid.length.toString());
      result.style.display = 'block';
    }
  }
  
  previewContainer.style.display = 'block';
}

/**
 * Confirmar importación
 */
function confirmImport() {
  if (pendingImport.length === 0) return;
  
  let added = 0;
  let duplicates = 0;
  
  pendingImport.forEach(c => {
    if (!contacts.some(existing => existing.number === c.number)) {
      contacts.push(c);
      added++;
    } else {
      duplicates++;
    }
  });
  
  pendingImport = [];
  renderContacts();
  resetUploadUI();
  
  let message = i18n('msgContactsImported', added.toString());
  if (duplicates > 0) {
    message += ' ' + i18n('msgDuplicates', duplicates.toString());
  }
  showNotification(message, 'success');
  
  // Cambiar a tab manual para ver los contactos
  setTimeout(() => switchTab('tab-manual'), 500);
}

/**
 * Cancelar importación
 */
function cancelImport() {
  pendingImport = [];
  resetUploadUI();
}

/**
 * Resetear UI de upload
 */
function resetUploadUI() {
  const fileInput = document.getElementById('file-input');
  const preview = document.getElementById('file-preview');
  const result = document.getElementById('import-result');
  const importPreview = document.getElementById('import-preview');
  const uploadZone = document.getElementById('upload-zone');
  
  if (fileInput) fileInput.value = '';
  if (preview) preview.style.display = 'none';
  if (result) result.style.display = 'none';
  if (importPreview) importPreview.style.display = 'none';
  if (uploadZone) uploadZone.style.display = 'block';
}

/**
 * Mostrar resultado de importación
 */
function showImportResult(success, message) {
  const result = document.getElementById('import-result');
  if (!result) return;
  
  result.className = `was-import-result ${success ? 'success' : 'error'}`;
  result.innerHTML = success
    ? `<strong>✓</strong> ${message}`
    : `<strong>✗</strong> ${message}`;
  result.style.display = 'block';
}

// Función legacy para compatibilidad
function downloadTemplate() {
  downloadExcelTemplate();
}

function removeUploadedFile() {
  resetUploadUI();
}

// ============================================
// Group Scraping - Sistema Mejorado
// ============================================

// Estado temporal para miembros de grupo
let pendingGroupMembers = [];

/**
 * Extraer miembros del grupo abierto
 */
async function scrapeGroupMembers() {
  const btn = document.getElementById('scrape-group-btn');
  const statusDiv = document.getElementById('group-extract-status');
  const statusMsg = document.getElementById('group-extract-message');
  const previewDiv = document.getElementById('group-members-preview');
  
  // Deshabilitar botón y mostrar estado
  if (btn) btn.disabled = true;
  if (statusDiv) statusDiv.style.display = 'flex';
  if (statusMsg) statusMsg.textContent = i18n('msgSearchingGroupMembers');
  if (previewDiv) previewDiv.style.display = 'none';
  
  try {
    // Enfocar la pestaña de WhatsApp
    await chrome.runtime.sendMessage({ action: 'focusWhatsAppTab' });
    await sleep(500);
    
    if (statusMsg) statusMsg.textContent = i18n('msgAnalyzingParticipants');
    
    // Llamar al content script
    const response = await sendToContent({ action: 'scrapeGroup' });
    
    if (response.error && (!response.members || response.members.length === 0)) {
      throw new Error(response.error);
    }
    
    const members = response.members || [];
    
    if (members.length === 0) {
      throw new Error(i18n('msgNoPhoneNumbersFound'));
    }
    
    // Guardar miembros pendientes y mostrar preview
    pendingGroupMembers = members;
    showGroupMembersPreview(members);
    
    if (statusMsg) statusMsg.textContent = i18n('msgMembersFound', members.length.toString());
    
    // Ocultar estado después de un momento
    setTimeout(() => {
      if (statusDiv) statusDiv.style.display = 'none';
    }, 1000);
    
  } catch (error) {
    console.error('Error scraping group:', error);
    
    if (statusMsg) statusMsg.textContent = i18n('msgErrorExtractingMembers');
    
    setTimeout(() => {
      if (statusDiv) statusDiv.style.display = 'none';
      showNotification(error.message || i18n('msgErrorGettingMembers'), 'error');
    }, 1000);
    
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Mostrar vista previa de miembros extraídos
 */
function showGroupMembersPreview(members) {
  const previewDiv = document.getElementById('group-members-preview');
  const countBadge = document.getElementById('members-count');
  const listDiv = document.getElementById('members-list');
  
  if (!previewDiv || !listDiv) return;
  
  // Actualizar contador
  if (countBadge) countBadge.textContent = members.length;
  
  // Generar lista de miembros (máximo 15 para el preview)
  const previewMembers = members.slice(0, 15);
  
  listDiv.innerHTML = previewMembers.map((m, i) => `
    <div class="was-member-item">
      <span class="was-member-phone">${formatPhoneNumber(m.phone || m)}</span>
      <span class="was-member-status">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        ${i18n('validLabel')}
      </span>
    </div>
  `).join('');
  
  // Mostrar mensaje si hay más
  if (members.length > 15) {
    listDiv.innerHTML += `
      <div class="was-members-more">
        ${i18n('andMoreMembers', (members.length - 15).toString())}
      </div>
    `;
  }
  
  previewDiv.style.display = 'block';
  
  // Scroll al preview
  previewDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Confirmar importación de miembros del grupo
 */
function confirmGroupImport() {
  if (pendingGroupMembers.length === 0) return;
  
  let added = 0;
  let duplicates = 0;
  
  pendingGroupMembers.forEach(member => {
    const phone = (typeof member === 'object' ? member.phone : member).replace(/\D/g, '');
    
    if (phone.length >= 10) {
      if (!contacts.some(c => c.number === phone)) {
        contacts.push({
          number: phone,
          name: '',
          status: 'pending',
          source: 'grupo'
        });
        added++;
      } else {
        duplicates++;
      }
    }
  });
  
  // Limpiar estado
  pendingGroupMembers = [];
  const previewDiv = document.getElementById('group-members-preview');
  if (previewDiv) previewDiv.style.display = 'none';
  
  // Actualizar UI
  renderContacts();
  
  // Mostrar resultado
  let message = i18n('msgMembersAddedToList', added.toString());
  if (duplicates > 0) {
    message += ' ' + i18n('msgDuplicates', duplicates.toString());
  }
  showNotification(message, 'success');
  
  // Cambiar a tab manual
  setTimeout(() => switchTab('tab-manual'), 500);
}

/**
 * Cancelar importación de miembros
 */
function cancelGroupImport() {
  pendingGroupMembers = [];
  const previewDiv = document.getElementById('group-members-preview');
  if (previewDiv) previewDiv.style.display = 'none';
  showNotification(i18n('msgImportCancelled'), 'info');
}

// ============================================
// Templates
// ============================================

function updateTemplateSelect() {
  const select = document.getElementById('template-select');
  const deleteBtn = document.getElementById('delete-template-btn');
  
  if (!select) return;
  
  select.innerHTML = `<option value="">${i18n('selectTemplate')}</option>`;
  
  templates.forEach((t, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = t.name;
    select.appendChild(option);
  });
  
  if (deleteBtn) {
    deleteBtn.style.display = templates.length > 0 ? 'flex' : 'none';
  }
}

function applyTemplate() {
  const select = document.getElementById('template-select');
  const idx = parseInt(select?.value);
  
  if (isNaN(idx)) return;
  
  const template = templates[idx];
  if (template) {
    const msgInput = document.getElementById('message-input');
    if (msgInput) msgInput.value = template.text;
    showNotification(i18n('msgTemplateApplied', template.name), 'success');
  }
}

async function saveTemplate() {
  const msgInput = document.getElementById('message-input');
  const text = msgInput?.value.trim();
  
  if (!text) {
    showNotification(i18n('msgWriteMessageFirst'), 'warning');
    return;
  }
  
  const name = prompt(i18n('promptTemplateName'));
  if (!name) return;
  
  templates.push({ name: name.trim(), text });
  await chrome.storage.local.set({ templates });
  updateTemplateSelect();
  showNotification(i18n('msgTemplateSaved', name), 'success');
}

async function deleteTemplate() {
  const select = document.getElementById('template-select');
  const idx = parseInt(select?.value);
  
  if (isNaN(idx)) {
    showNotification(i18n('msgSelectTemplateToDelete'), 'warning');
    return;
  }
  
  const template = templates[idx];
  if (confirm(i18n('confirmDeleteTemplate', template.name))) {
    templates.splice(idx, 1);
    await chrome.storage.local.set({ templates });
    updateTemplateSelect();
    if (select) select.value = '';
    showNotification(i18n('msgTemplateDeleted'), 'success');
  }
}

// ============================================
// Text Formatting
// ============================================

function insertFormat(char) {
  const textarea = document.getElementById('message-input');
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selection = text.substring(start, end);
  
  let newText;
  if (char === '```') {
    newText = text.substring(0, start) + '```' + selection + '```' + text.substring(end);
  } else {
    newText = text.substring(0, start) + char + selection + char + text.substring(end);
  }
  
  textarea.value = newText;
  textarea.focus();
  textarea.setSelectionRange(start + char.length, end + char.length);
}

function insertVariable(variable) {
  const textarea = document.getElementById('message-input');
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const text = textarea.value;
  
  textarea.value = text.substring(0, start) + variable + text.substring(start);
  textarea.focus();
  textarea.setSelectionRange(start + variable.length, start + variable.length);
}

function insertText(text) {
  const textarea = document.getElementById('message-input');
  if (!textarea) return;
  
  textarea.value += text;
  textarea.focus();
}

// ============================================
// Attachment
// ============================================

function handleAttachment(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  currentAttachment = file;
  
  const preview = document.getElementById('attachment-preview');
  const icon = document.getElementById('attachment-icon');
  const name = document.getElementById('attachment-name');
  
  if (name) name.textContent = file.name;
  
  if (icon) {
    if (file.type.startsWith('image/')) {
      icon.innerHTML = '<path fill="#22c55e" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>';
    } else if (file.type.startsWith('video/')) {
      icon.innerHTML = '<path fill="#3b82f6" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>';
    } else {
      icon.innerHTML = '<path fill="#64748b" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>';
    }
  }
  
  if (preview) preview.style.display = 'flex';
  showNotification(i18n('msgFileAttached', file.name), 'success');
}

function removeAttachment() {
  currentAttachment = null;
  const input = document.getElementById('attachment-input');
  const preview = document.getElementById('attachment-preview');
  
  if (input) input.value = '';
  if (preview) preview.style.display = 'none';
}

// ============================================
// Settings
// ============================================

function handleIntervalChange(event) {
  const btn = event.target;
  const action = btn.getAttribute('data-action');
  const targetId = btn.getAttribute('data-target');
  const input = document.getElementById(targetId);
  
  if (!input) return;
  
  let value = parseInt(input.value) || 0;
  
  if (action === 'increase') {
    value++;
  } else if (action === 'decrease' && value > 1) {
    value--;
  }
  
  input.value = value;
  saveSettings();
}

async function resetStats() {
  const stats = { totalSent: 0, totalFailed: 0, lastSession: null };
  await chrome.storage.local.set({ stats });
  updateStatsDisplay(stats);
  showNotification(i18n('msgStatsReset'), 'success');
}

function updateStatsDisplay(stats) {
  const sent = document.getElementById('stat-sent');
  const failed = document.getElementById('stat-failed');
  
  if (sent) sent.textContent = stats.totalSent || 0;
  if (failed) failed.textContent = stats.totalFailed || 0;
}

function updatePendingStats() {
  const pending = contacts.filter(c => c.status === 'pending').length;
  const pendingEl = document.getElementById('stat-pending');
  if (pendingEl) pendingEl.textContent = pending;
}

// ============================================
// Sending Logic
// ============================================

async function sendTestMessage() {
  const msgInput = document.getElementById('message-input');
  const message = msgInput?.value.trim();
  
  if (!message && !currentAttachment) {
    showNotification(i18n('msgWriteMessageOrAttach'), 'warning');
    return;
  }
  
  let testNumber = await getTestNumber();
  if (!testNumber) return;
  
  showNotification(i18n('msgSendingTestMessage'), 'info');
  
  try {
    const result = await sendSingleMessage(testNumber, message);
    if (result.success) {
      showNotification(i18n('msgTestSentSuccess'), 'success');
    } else {
      showNotification(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function getTestNumber() {
  const result = await chrome.storage.local.get(['testNumber']);
  let testNumber = result.testNumber;
  
  if (!testNumber) {
    testNumber = prompt(i18n('promptTestNumber'));
    if (testNumber) {
      testNumber = testNumber.replace(/\D/g, '');
      await chrome.storage.local.set({ testNumber });
    }
  }
  
  return testNumber;
}

async function startSending() {
  const msgInput = document.getElementById('message-input');
  const message = msgInput?.value.trim();
  
  if (!message && !currentAttachment) {
    showNotification(i18n('msgWriteMessageOrAttach'), 'warning');
    return;
  }
  
  const pendingContacts = contacts.filter(c => c.status === 'pending');
  if (pendingContacts.length === 0) {
    showNotification(i18n('msgNoPendingContacts'), 'warning');
    return;
  }
  
  if (!confirm(i18n('confirmSendToContacts', pendingContacts.length.toString()))) {
    return;
  }
  
  // Enfocar WhatsApp antes de enviar
  await chrome.runtime.sendMessage({ action: 'focusWhatsAppTab' });
  
  isSending = true;
  shouldStop = false;
  updateUIState(true);
  
  const minDelay = (settings.delayMin || 6) * 1000;
  const maxDelay = (settings.delayMax || 10) * 1000;
  
  let sent = 0;
  let failed = 0;
  
  for (let i = 0; i < contacts.length; i++) {
    if (shouldStop) break;
    if (contacts[i].status !== 'pending') continue;
    
    contacts[i].status = 'sending';
    renderContacts();
    scrollToContact(i);
    
    try {
      let finalMessage = processVariables(message, contacts[i]);
      
      if (settings.antiBan) {
        finalMessage += `\n\n[ID: ${Date.now().toString().slice(-6)}]`;
      }
      
      if (settings.addTimestamp) {
        finalMessage += `\n\n📅 ${new Date().toLocaleString()}`;
      }
      
      const result = await sendSingleMessage(contacts[i].number, finalMessage);
      
      if (result.success) {
        contacts[i].status = 'sent';
        sent++;
        await updateGlobalStats('sent');
      } else {
        contacts[i].status = 'error';
        failed++;
        await updateGlobalStats('failed');
      }
    } catch (error) {
      console.error('Error sending to', contacts[i].number, error);
      contacts[i].status = 'error';
      failed++;
      await updateGlobalStats('failed');
    }
    
    renderContacts();
    updateProgress(i + 1, contacts.length);
    
    if (i < contacts.length - 1 && !shouldStop) {
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      await countdown(delay);
    }
  }
  
  isSending = false;
  updateUIState(false);
  
  if (shouldStop) {
    showNotification(i18n('msgSendingStopped'), 'warning');
  } else {
    showNotification(i18n('msgSendingComplete', sent.toString(), failed.toString()), 'success');
  }
}

function stopSending() {
  shouldStop = true;
  showNotification(i18n('msgStoppingSending'), 'warning');
}

async function sendSingleMessage(phone, text) {
  return new Promise((resolve) => {
    sendToContent({
      action: 'sendMessage',
      phone: phone,
      text: text,
      attachment: currentAttachment ? {
        name: currentAttachment.name,
        type: currentAttachment.type,
        data: null
      } : null
    }).then(response => {
      resolve(response || { success: false, error: 'No response' });
    }).catch(error => {
      resolve({ success: false, error: error.message });
    });
  });
}

function processVariables(text, contact) {
  return text
    .replace(/\{\{numero\}\}/gi, contact.number)
    .replace(/\{\{nombre\}\}/gi, contact.name || '')
    .replace(/\{\{fecha\}\}/gi, new Date().toLocaleDateString());
}

async function updateGlobalStats(type) {
  const result = await chrome.storage.local.get(['stats']);
  const stats = result.stats || { totalSent: 0, totalFailed: 0 };
  
  if (type === 'sent') stats.totalSent++;
  if (type === 'failed') stats.totalFailed++;
  stats.lastSession = new Date().toISOString();
  
  await chrome.storage.local.set({ stats });
  updateStatsDisplay(stats);
}

// ============================================
// UI Updates
// ============================================

function updateUIState(sending) {
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const progressContainer = document.getElementById('progress-container');
  
  if (sendBtn) sendBtn.style.display = sending ? 'none' : 'flex';
  if (stopBtn) stopBtn.style.display = sending ? 'flex' : 'none';
  if (progressContainer) progressContainer.style.display = sending ? 'block' : 'none';
  
  const inputs = [
    'number-input', 'add-number-btn', 'clear-contacts-btn',
    'file-input', 'message-input', 'template-select',
    'save-template-btn', 'quick-send-btn'
  ];
  
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = sending;
  });
}

function updateProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  
  if (bar) bar.style.width = `${percentage}%`;
  if (text) text.textContent = `${current} / ${total}`;
}

async function countdown(ms) {
  const stopBtnText = document.getElementById('stop-btn-text');
  const seconds = Math.ceil(ms / 1000);
  
  for (let i = seconds; i > 0; i--) {
    if (shouldStop) break;
    if (stopBtnText) stopBtnText.textContent = i18n('msgWaitingSeconds', i.toString());
    await sleep(1000);
  }
  
  if (stopBtnText) stopBtnText.textContent = i18n('stopSending');
}

function scrollToContact(index) {
  const item = document.querySelector(`.was-contact-item[data-index="${index}"]`);
  if (item) {
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================
// Communication with Content Script
// ============================================

async function sendToContent(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ ...message, target: 'content' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ============================================
// Notifications
// ============================================

function showNotification(message, type = 'info') {
  console.log(`[WA Sender Pro] ${type.toUpperCase()}: ${message}`);
  
  const statusBar = document.getElementById('status-bar');
  const statusText = statusBar?.querySelector('.was-status-text');
  const statusDot = statusBar?.querySelector('.was-status-dot');
  
  if (!statusText || !statusDot) return;
  
  const originalText = statusText.textContent;
  const originalDotClass = statusDot.className;
  
  // Cambiar color del punto según el tipo
  statusDot.className = 'was-status-dot';
  switch (type) {
    case 'success':
      statusDot.style.background = '#22c55e';
      break;
    case 'error':
      statusDot.style.background = '#ef4444';
      break;
    case 'warning':
      statusDot.style.background = '#f59e0b';
      break;
    default:
      statusDot.style.background = '#3b82f6';
  }
  
  statusText.textContent = message;
  
  setTimeout(() => {
    statusText.textContent = i18n('statusConnected');
    statusDot.style.background = '#22c55e';
  }, 3000);
}

// ============================================
// Utilities
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
