# 🚀 WA Sender Pro v2.0

> Extensión de Chrome profesional para envío masivo de mensajes en WhatsApp Web

![Version](https://img.shields.io/badge/version-2.0.0-green)
![Chrome](https://img.shields.io/badge/Chrome-Extension-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ Características Principales

### 📱 Gestión de Contactos
- **Añadir manualmente**: Ingresa números con validación automática
- **Importar Excel/CSV**: Soporte completo para archivos `.xlsx`, `.xls`, `.csv` y `.txt`
- **Plantilla descargable**: Genera un archivo Excel de ejemplo con el formato correcto
- **Obtener de grupos**: Extrae automáticamente los miembros de un grupo de WhatsApp
- **Detección de duplicados**: Evita añadir el mismo número dos veces

### 💬 Composición de Mensajes
- **Plantillas guardadas**: Guarda y reutiliza mensajes frecuentes
- **Variables dinámicas**:
  - `{{numero}}` - Número de teléfono del destinatario
  - `{{nombre}}` - Nombre del contacto (si está disponible)
  - `{{fecha}}` - Fecha actual
- **Formato de texto**: Negrita, cursiva, tachado y código
- **Adjuntos**: Soporte para imágenes, videos y documentos
- **Acciones rápidas**: Añadir disculpa o marca de tiempo con un clic

### ⚙️ Configuración Avanzada
- **Intervalos personalizables**: Control de tiempo entre mensajes (evita bloqueos)
- **Anti-Bloqueo**: Añade un ID único a cada mensaje
- **Marca de tiempo automática**: Opcional al final de cada mensaje
- **Estadísticas en tiempo real**: Mensajes enviados, fallidos y pendientes

### 🎨 Interfaz Moderna
- **Panel lateral nativo**: Se integra perfectamente con Chrome
- **Diseño responsive**: Funciona en cualquier tamaño de ventana
- **Tabs organizados**: Manual, Excel/CSV, Grupos y Ajustes
- **Indicadores visuales**: Estado de conexión y progreso de envío

## 📦 Instalación

### Opción 1: Instalación Manual (Desarrollador)

1. **Descarga o clona** este repositorio
2. Abre Chrome y navega a `chrome://extensions/`
3. Activa el **Modo desarrollador** (esquina superior derecha)
4. Haz clic en **Cargar descomprimida**
5. Selecciona la carpeta del proyecto

### Opción 2: Desde Chrome Web Store
*(Próximamente)*

## 🚀 Cómo Usar

### Paso 1: Abrir WA Sender Pro
1. Haz clic en el icono de la extensión en la barra de Chrome
2. **¡Eso es todo!** La extensión:
   - Detectará automáticamente si WhatsApp Web está abierto
   - Si está abierto, enfocará esa pestaña
   - Si no está abierto, lo abrirá automáticamente
   - Esperará a que WhatsApp cargue completamente
   - Mostrará una pantalla de QR si es necesario escanear

### Paso 2: (Opcional) Escanear QR
Si es la primera vez o tu sesión expiró:
1. Abre WhatsApp en tu teléfono
2. Escanea el código QR que aparece en pantalla

### Paso 3: Añadir Contactos

**Manual:**
- Ingresa el número con código de país (ej: `521234567890`)
- Clic en el botón `+` o presiona Enter

**Desde Excel/CSV:**
1. Ve a la pestaña "Excel/CSV"
2. Descarga la plantilla o usa tu propio archivo
3. Sube el archivo con los números
4. Los contactos se importarán automáticamente

**Desde Grupos:**
1. Abre un grupo en WhatsApp Web
2. Haz clic en el nombre del grupo para ver info
3. Desplázate para ver los participantes
4. Ve a la pestaña "Grupos" y clic en "Obtener Miembros"

### Paso 4: Escribir Mensaje
1. Escribe tu mensaje en el área de texto
2. Usa variables como `{{numero}}` para personalizar
3. Opcionalmente, adjunta un archivo

### Paso 5: Configurar y Enviar
1. Ve a "Ajustes" para configurar intervalos
2. Haz clic en "Hacer prueba" para probar con tu número
3. Cuando estés listo, clic en "Enviar Mensajes"

## 📁 Estructura del Proyecto

```
wa-sender-pro/
├── manifest.json      # Configuración de la extensión
├── background.js      # Service worker
├── content.js         # Script inyectado en WhatsApp Web
├── sidebar.html       # Interfaz del panel lateral
├── sidebar.css        # Estilos de la UI
├── sidebar.js         # Lógica de la UI
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── CHANGELOG.md
```

## ⚠️ Solución de Problemas

### El sidebar no aparece
- Asegúrate de estar en `web.whatsapp.com`
- Recarga la página de WhatsApp Web
- Verifica que la extensión esté habilitada

### Los mensajes no se envían
- Revisa que WhatsApp Web esté conectado y funcionando
- Verifica que los números tengan el formato correcto
- Aumenta el intervalo entre mensajes en Ajustes

### Error "Número inválido"
- Asegúrate de usar el código de país correcto
- El número debe tener entre 10 y 15 dígitos
- Algunos números pueden no tener WhatsApp

### La importación de Excel no funciona
- Usa la plantilla descargable como guía
- Los números deben estar en la primera columna
- Formatos soportados: `.xlsx`, `.xls`, `.csv`, `.txt`

## 🔒 Privacidad y Seguridad

- **Sin servidores externos**: Todo se procesa localmente
- **Almacenamiento local**: Plantillas y configuración en tu navegador
- **No recopilamos datos**: Tu información nunca sale de tu computadora
- **Código abierto**: Puedes revisar todo el código fuente

## 📄 Licencia

MIT License - Usa, modifica y distribuye libremente.

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcion`)
3. Commit de tus cambios (`git commit -m 'Añade nueva función'`)
4. Push a la rama (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

## 📞 Soporte

Si encuentras un bug o tienes una sugerencia:
- Abre un [Issue](../../issues) en GitHub
- Describe el problema con detalle
- Incluye capturas de pantalla si es posible

---

**Hecho con ❤️ para la comunidad**

*WA Sender Pro no está afiliado con WhatsApp Inc.*

