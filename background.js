// ============================================
// WA Sender Pro v2.1 - Background Service Worker
// Sistema Inteligente de Detección de WhatsApp
// ============================================

// Estado global de la pestaña de WhatsApp
let whatsappTabInfo = {
  tabId: null,
  windowId: null,
  ready: false,
  lastChecked: null
};

// ============================================
// Configuración Inicial
// ============================================

// Configurar el side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

// Al instalar/actualizar la extensión
chrome.runtime.onInstalled.addListener((details) => {
  console.log("WA Sender Pro v2.1 installed/updated");
  
  if (details.reason === 'install') {
    chrome.storage.local.set({
      templates: [],
      settings: {
        delayMin: 6,
        delayMax: 10,
        antiBan: false,
        deleteAfter: false,
        addTimestamp: false
      },
      stats: {
        totalSent: 0,
        totalFailed: 0,
        lastSession: null
      }
    });
  }
  
  // Actualizar badge inicial
  updateExtensionBadge('offline');
});

// ============================================
// Funciones Principales de Detección
// ============================================

/**
 * Buscar pestaña existente de WhatsApp Web o crear una nueva
 */
async function findOrOpenWhatsApp() {
  try {
    // 1. Buscar pestañas existentes de WhatsApp Web
    const tabs = await chrome.tabs.query({
      url: ["https://web.whatsapp.com/*", "https://web.whatsapp.com/"]
    });
    
    // 2. Si existe al menos una pestaña
    if (tabs.length > 0) {
      const tab = tabs[0];
      
      // Cerrar pestañas duplicadas si existen
      if (tabs.length > 1) {
        console.log(`Cerrando ${tabs.length - 1} pestañas duplicadas de WhatsApp`);
        for (let i = 1; i < tabs.length; i++) {
          try {
            await chrome.tabs.remove(tabs[i].id);
          } catch (e) {
            console.warn('Error al cerrar pestaña duplicada:', e);
          }
        }
      }
      
      // Enfocar la pestaña y ventana
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      
      // Actualizar estado
      whatsappTabInfo = {
        tabId: tab.id,
        windowId: tab.windowId,
        ready: false,
        lastChecked: Date.now()
      };
      
      console.log('WhatsApp Web encontrado, enfocando pestaña:', tab.id);
      return { success: true, tabId: tab.id, windowId: tab.windowId, wasOpen: true };
    }
    
    // 3. No existe, crear nueva pestaña
    console.log('WhatsApp Web no encontrado, abriendo nueva pestaña...');
    const newTab = await chrome.tabs.create({
      url: 'https://web.whatsapp.com',
      active: true
    });
    
    whatsappTabInfo = {
      tabId: newTab.id,
      windowId: newTab.windowId,
      ready: false,
      lastChecked: Date.now()
    };
    
    return { success: true, tabId: newTab.id, windowId: newTab.windowId, wasOpen: false };
    
  } catch (error) {
    console.error('Error al buscar/abrir WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verificar si WhatsApp Web está completamente cargado
 */
async function checkWhatsAppReady(tabId) {
  try {
    // Verificar que la pestaña existe
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (e) {
      return { ready: false, error: 'Tab not found', status: 'closed' };
    }
    
    // Verificar que la URL es de WhatsApp
    if (!tab.url || !tab.url.includes('web.whatsapp.com')) {
      return { ready: false, error: 'Not WhatsApp', status: 'wrong_url' };
    }
    
    // Verificar estado de carga de la pestaña
    if (tab.status !== 'complete') {
      return { ready: false, status: 'loading' };
    }
    
    // Inyectar script para verificar elementos de WhatsApp
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Verificar elementos críticos de WhatsApp Web
        const app = document.querySelector('#app');
        const side = document.querySelector('#side');
        const pane = document.querySelector('#pane-side');
        const chatList = document.querySelector('[data-testid="chat-list"]');
        const mainPanel = document.querySelector('[data-testid="conversation-panel-wrapper"]');
        
        // Detectar si necesita escanear QR
        const qrCode = document.querySelector('canvas[aria-label*="QR"]') ||
                       document.querySelector('[data-testid="qrcode"]') ||
                       document.querySelector('div[data-ref]');
        
        // Detectar pantalla de carga
        const loadingScreen = document.querySelector('[data-testid="startup"]') ||
                              document.querySelector('.landing-wrapper');
        
        const ready = app !== null && (side !== null || pane !== null || chatList !== null);
        
        return {
          ready: ready,
          hasApp: app !== null,
          hasSide: side !== null,
          hasPane: pane !== null,
          hasChatList: chatList !== null,
          needsQRScan: qrCode !== null,
          isLoading: loadingScreen !== null
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      
      // Actualizar estado
      if (result.ready) {
        whatsappTabInfo.ready = true;
        updateExtensionBadge('ready');
      } else if (result.needsQRScan) {
        updateExtensionBadge('qr');
      } else if (result.isLoading) {
        updateExtensionBadge('loading');
      }
      
      return { 
        ready: result.ready, 
        status: result.needsQRScan ? 'qr_required' : (result.isLoading ? 'loading' : 'checking'),
        ...result 
      };
    }
    
    return { ready: false, status: 'unknown' };
    
  } catch (error) {
    console.error('Error al verificar WhatsApp:', error);
    return { ready: false, error: error.message, status: 'error' };
  }
}

/**
 * Obtener información actual de la pestaña de WhatsApp
 */
async function getWhatsAppTabInfo() {
  // Verificar si la pestaña guardada aún existe
  if (whatsappTabInfo.tabId) {
    try {
      const tab = await chrome.tabs.get(whatsappTabInfo.tabId);
      if (tab.url && tab.url.includes('web.whatsapp.com')) {
        return whatsappTabInfo;
      }
    } catch (e) {
      // La pestaña ya no existe
    }
  }
  
  // Buscar pestaña de WhatsApp
  const tabs = await chrome.tabs.query({
    url: ["https://web.whatsapp.com/*", "https://web.whatsapp.com/"]
  });
  
  if (tabs.length > 0) {
    whatsappTabInfo = {
      tabId: tabs[0].id,
      windowId: tabs[0].windowId,
      ready: false,
      lastChecked: Date.now()
    };
    return whatsappTabInfo;
  }
  
  return { tabId: null, windowId: null, ready: false };
}

// ============================================
// Badge del icono de la extensión
// ============================================

async function updateExtensionBadge(status) {
  const badgeConfig = {
    'ready': { text: '✓', color: '#22c55e' },
    'loading': { text: '...', color: '#f59e0b' },
    'qr': { text: 'QR', color: '#3b82f6' },
    'error': { text: '!', color: '#ef4444' },
    'offline': { text: '', color: '#9ca3af' }
  };
  
  const config = badgeConfig[status] || badgeConfig.offline;
  
  try {
    await chrome.action.setBadgeText({ text: config.text });
    await chrome.action.setBadgeBackgroundColor({ color: config.color });
  } catch (e) {
    console.warn('Error updating badge:', e);
  }
}

// ============================================
// Listeners de Eventos
// ============================================

// Cuando se hace clic en el icono de la extensión
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Primero buscar/abrir WhatsApp
    const result = await findOrOpenWhatsApp();
    
    if (result.success) {
      // Abrir el panel lateral en la ventana de WhatsApp
      await chrome.sidePanel.open({ windowId: result.windowId });
    }
  } catch (error) {
    console.error('Error opening extension:', error);
  }
});

// Monitorear actualizaciones de pestañas
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  
  if (tab.url.includes('web.whatsapp.com')) {
    // Habilitar el panel para esta pestaña
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidebar.html',
      enabled: true
    });
    
    // Actualizar información de la pestaña
    whatsappTabInfo.tabId = tabId;
    whatsappTabInfo.windowId = tab.windowId;
    
    // Verificar si WhatsApp está listo cuando termine de cargar
    if (changeInfo.status === 'complete') {
      const readyCheck = await checkWhatsAppReady(tabId);
      whatsappTabInfo.ready = readyCheck.ready;
    }
  } else {
    // Deshabilitar el panel para pestañas que no son WhatsApp
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});

// Monitorear cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  if (whatsappTabInfo.tabId === tabId) {
    console.log('WhatsApp Web tab closed');
    whatsappTabInfo = { tabId: null, windowId: null, ready: false, lastChecked: null };
    updateExtensionBadge('offline');
  }
});

// ============================================
// Message Handler
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mensajes de control de WhatsApp
  if (message.action === 'findOrOpenWhatsApp') {
    findOrOpenWhatsApp().then(sendResponse);
    return true;
  }
  
  if (message.action === 'checkWhatsAppReady') {
    const tabId = message.tabId || whatsappTabInfo.tabId;
    if (tabId) {
      checkWhatsAppReady(tabId).then(sendResponse);
    } else {
      sendResponse({ ready: false, error: 'No tab ID' });
    }
    return true;
  }
  
  if (message.action === 'getWhatsAppTabInfo') {
    getWhatsAppTabInfo().then(sendResponse);
    return true;
  }
  
  if (message.action === 'focusWhatsAppTab') {
    if (whatsappTabInfo.tabId) {
      chrome.tabs.update(whatsappTabInfo.tabId, { active: true })
        .then(() => chrome.windows.update(whatsappTabInfo.windowId, { focused: true }))
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    } else {
      sendResponse({ success: false, error: 'No WhatsApp tab' });
    }
    return true;
  }
  
  // Relay de mensajes al content script
  if (message.target === 'content') {
    const tabId = whatsappTabInfo.tabId;
    
    if (!tabId) {
      // Buscar pestaña de WhatsApp
      chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, message, sendResponse);
        } else {
          sendResponse({ error: 'No WhatsApp Web tab found' });
        }
      });
      return true;
    }
    
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
    return true;
  }
  
  // Actualizar estadísticas
  if (message.action === 'updateStats') {
    chrome.storage.local.get(['stats'], (result) => {
      const stats = result.stats || { totalSent: 0, totalFailed: 0 };
      if (message.status === 'sent') {
        stats.totalSent++;
      } else if (message.status === 'failed') {
        stats.totalFailed++;
      }
      stats.lastSession = new Date().toISOString();
      chrome.storage.local.set({ stats });
      sendResponse({ success: true });
    });
    return true;
  }
  
  return false;
});

// ============================================
// Inicialización
// ============================================

// Verificar estado de WhatsApp al iniciar el service worker
(async () => {
  const tabs = await chrome.tabs.query({
    url: ["https://web.whatsapp.com/*", "https://web.whatsapp.com/"]
  });
  
  if (tabs.length > 0) {
    whatsappTabInfo.tabId = tabs[0].id;
    whatsappTabInfo.windowId = tabs[0].windowId;
    
    const readyCheck = await checkWhatsAppReady(tabs[0].id);
    whatsappTabInfo.ready = readyCheck.ready;
    
    console.log('WhatsApp Web detectado al iniciar:', whatsappTabInfo);
  }
})();
