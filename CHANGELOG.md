# Changelog - WA Sender Pro

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [2.2.0] - 2024-11-27

### 🌐 Internacionalización (i18n) - Soporte Multiidioma

#### Nuevas Características
- **Soporte para múltiples idiomas**: La extensión ahora puede mostrar textos en diferentes idiomas
- **Idiomas disponibles**: Inglés (default) y Español
- **Detección automática**: El idioma se selecciona automáticamente según el navegador
- **Sistema i18n de Chrome**: Usa el sistema nativo de internacionalización de Chrome

#### Archivos de Idiomas
- `_locales/en/messages.json` - Inglés (idioma por defecto)
- `_locales/es/messages.json` - Español

#### Textos Traducidos
- Todos los textos de la interfaz de usuario (botones, etiquetas, títulos)
- Mensajes de notificación y alertas
- Mensajes de error y confirmación
- Placeholders y tooltips
- Instrucciones y descripciones

#### Cambios Técnicos
- Añadido `"default_locale": "en"` en manifest.json
- Función helper `i18n()` para obtener mensajes traducidos
- Función `applyI18n()` para aplicar traducciones al cargar la página
- Atributos `data-i18n`, `data-i18n-title`, `data-i18n-placeholder` en HTML

#### Notas para Desarrolladores
- Para añadir un nuevo idioma, crear carpeta en `_locales/[código ISO]/`
- Copiar `messages.json` de `en/` y traducir los valores `"message"`
- Los placeholders usan formato `$NOMBRE$` para variables

---

## [2.1.2] - 2024-11-27

### 👥 Tab Grupos - Simplificado y Mejorado

#### Cambios
- **Eliminados** dropdowns innecesarios (Grupo guardado, Etiqueta)
- **Añadida** vista previa de miembros antes de importar
- **Añadido** disclaimer de uso responsable
- **Mejorado** algoritmo de extracción con múltiples selectores
- **Mejorada** UI con instrucciones paso a paso numeradas
- **Añadido** indicador de estado durante extracción
- **Añadidos** botones de confirmar/cancelar importación

#### Mejoras Técnicas en content.js
- 5 métodos diferentes de extracción de números
- Selectores actualizados para WhatsApp Web 2024
- Manejo robusto de errores con mensajes claros
- Detección automática de código de país

---

## [2.1.1] - 2024-11-27

### 📊 Sistema Completo de Plantillas Excel/CSV

#### Nuevas Características
- **Botones separados**: Descargar plantilla Excel (.xlsx) o CSV
- **Plantilla profesional**: 5 columnas (phone, name, var1, var2, var3)
- **Zona de arrastrar y soltar (Drag & Drop)**: Arrastra archivos directamente
- **Detección inteligente de columnas**: Reconoce variaciones de nombres (phone, telefono, number, etc.)
- **Vista previa antes de importar**: Ve los contactos antes de confirmarlos
- **Validación avanzada**: Detecta y reporta números inválidos
- **Soporte para variables personalizadas**: var1, var2, var3 para personalización
- **Detección automática de delimitador CSV**: Soporta coma, punto y coma, tab, pipe

#### Mejoras de UX
- Iconos diferenciados para Excel y CSV
- Información del archivo (nombre, tamaño)
- Tags visuales para columnas disponibles
- Instrucciones paso a paso integradas
- Animaciones al arrastrar archivos

#### Columnas Soportadas
- **phone** (obligatorio): número de teléfono
- **name**: nombre del contacto
- **var1, var2, var3**: variables personalizadas

---

## [2.1.0] - 2024-11-27

### 🚀 Sistema Inteligente de Detección de WhatsApp

#### Nuevas Características
- **Detección automática**: La extensión detecta automáticamente si WhatsApp Web está abierto
- **Enfoque inteligente**: Si WhatsApp ya está abierto, se enfoca esa pestaña en lugar de abrir otra
- **Apertura automática**: Si WhatsApp no está abierto, se abre automáticamente
- **Sin botones manuales**: El proceso es 100% automático y transparente
- **Pantalla de carga**: Muestra el progreso de conexión con pasos visuales
- **Pantalla de QR**: Detecta cuando es necesario escanear el código QR
- **Pantalla de error**: Manejo elegante de errores con botón de reintento
- **Badge en icono**: Indicador visual del estado de conexión (✓, QR, !)

#### Mejoras Técnicas
- Añadido permiso `tabs` para búsqueda y enfoque de pestañas
- Cierre automático de pestañas duplicadas de WhatsApp
- Verificación robusta del estado de carga de WhatsApp Web
- Monitoreo de cambios en pestañas

---

## [2.0.0] - 2024-11-27

### 🚀 Cambios Mayores

#### Arquitectura Completamente Renovada
- **SOLUCIONADO**: El sidebar ahora usa `chrome.sidePanel` API nativa
- **ELIMINADO**: Botón flotante no deseado que se inyectaba en WhatsApp Web
- **SEPARACIÓN DE RESPONSABILIDADES**: 
  - `sidebar.html/js/css` → Interfaz de usuario
  - `content.js` → Solo interacción con WhatsApp Web
  - `background.js` → Service worker y coordinación

#### Nueva Interfaz de Usuario
- Diseño moderno inspirado en WhatsApp
- Sistema de tabs: Manual, Excel/CSV, Grupos, Ajustes
- Indicador de conexión en tiempo real
- Barra de progreso durante el envío
- Animaciones suaves y transiciones

### ✨ Nuevas Características

#### Gestión de Contactos
- ✅ Importación de archivos Excel (.xlsx, .xls)
- ✅ Importación de archivos CSV y TXT
- ✅ Descarga de plantilla Excel con formato correcto
- ✅ Detección automática de duplicados
- ✅ Validación de números mejorada
- ✅ Contador de contactos en tiempo real

#### Composición de Mensajes
- ✅ Sistema de plantillas con guardar/eliminar
- ✅ Variables dinámicas: `{{numero}}`, `{{nombre}}`, `{{fecha}}`
- ✅ Botones de formato: Negrita, Cursiva, Tachado, Código
- ✅ Botones de acción rápida
- ✅ Vista previa de adjuntos mejorada

#### Configuración
- ✅ Intervalos de tiempo con controles +/-
- ✅ Toggle de Anti-Bloqueo (ID único)
- ✅ Toggle de marca de tiempo automática
- ✅ Toggle de eliminar chat después de enviar

#### Estadísticas
- ✅ Contador de mensajes enviados
- ✅ Contador de mensajes fallidos
- ✅ Contador de pendientes
- ✅ Botón para reiniciar estadísticas

### 🔧 Mejoras Técnicas

- Migración a Manifest V3 completa
- Uso de `chrome.storage.local` para persistencia
- Comunicación vía messaging entre sidebar y content script
- Manejo de errores mejorado
- Código modular y comentado
- Carga de SheetJS desde CDN para Excel

### 🐛 Bugs Corregidos

- Sidebar no se abría correctamente como panel nativo
- Botón flotante interfería con WhatsApp Web
- CSS se inyectaba innecesariamente en la página
- Plantillas no se guardaban correctamente
- Números duplicados se añadían a la lista

### 🗑️ Eliminado

- Código del botón flotante (`#wa-sender-toggle`)
- Inyección de UI en el DOM de WhatsApp
- Archivo `styles.css` (reemplazado por `sidebar.css`)
- Funciones obsoletas de la versión 1.x

---

## [1.0.0] - Versión Anterior

### Características Originales
- Sidebar inyectado en WhatsApp Web
- Añadir contactos manualmente
- Importar CSV/TXT básico
- Sistema de plantillas simple
- Envío con intervalos
- Obtener miembros de grupo (básico)

### Problemas Conocidos (Corregidos en v2.0)
- ❌ Sidebar no era nativo de Chrome
- ❌ Botón flotante no deseado
- ❌ No soportaba Excel real
- ❌ Sin variables dinámicas
- ❌ Sin estadísticas

---

## Roadmap Futuro

### v2.1.0 (Planeado)
- [ ] Mensajes programados (scheduler)
- [ ] Respuestas automáticas
- [ ] Integración con Google Contacts
- [ ] Modo oscuro

### v2.2.0 (Planeado)
- [ ] Exportar estadísticas a Excel
- [ ] Historial de envíos
- [ ] Backup/Restore de configuración
- [ ] Múltiples perfiles de envío

---

*Para reportar bugs o sugerir características, abre un Issue en GitHub.*

