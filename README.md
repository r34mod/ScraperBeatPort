# Beatport Top100 Scraper

Un software completo para extraer las listas Top100 de cada género musical de Beatport y descargarlas en formato CSV.

## 🚀 Características

- **Web Scraping Avanzado**: Utiliza Puppeteer para extraer datos de Beatport
- **Múltiples Géneros**: Soporta todos los géneros principales (House, Techno, Trance, etc.)
- **Interfaz Web Intuitiva**: Frontend HTML5 moderno y responsive
- **Descarga CSV**: Genera archivos CSV con información completa de cada track
- **Procesamiento por Lotes**: Puede extraer múltiples géneros simultáneamente

## 📋 Datos Extraídos

Para cada track del Top100, el sistema extrae:

- Posición en el chart
- Título de la canción
- Artista principal
- Remixer (si aplica)
- Sello discográfico
- Fecha de lanzamiento
- Género musical
- BPM (beats por minuto)
- Clave musical
- Duración

## 🛠️ Instalación

### Prerrequisitos

- Node.js (versión 14 o superior)
- npm o yarn
- Conexión a internet estable

### Pasos de instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd ListMusic
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   npm start
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 📖 Uso

### Interfaz Web

1. **Accede a la aplicación** en `http://localhost:3000`
2. **Selecciona géneros** haciendo clic en las tarjetas de género
3. **Inicia la extracción** con el botón "Extraer Top100"
4. **Espera el procesamiento** (puede tomar varios minutos)
5. **Descarga los archivos CSV** generados

### API Endpoints

#### Obtener géneros disponibles
```http
GET /api/genres
```

#### Extraer Top100 de un género
```http
GET /api/scrape/:genre
```

#### Extraer múltiples géneros
```http
POST /api/scrape-multiple
Content-Type: application/json

{
  "genres": ["house", "techno", "trance"]
}
```

#### Descargar archivo CSV
```http
GET /api/download/:filename
```

## 🎵 Géneros Soportados

- **House**: Todas las variantes de House
- **Techno**: Techno tradicional y moderno
- **Tech House**: Fusión de Techno y House
- **Deep House**: House más melódico y profundo
- **Progressive House**: House progresivo
- **Electro House**: House electrónico
- **Minimal**: Minimal Deep Tech
- **Trance**: Trance clásico
- **Progressive Trance**: Trance progresivo y Psy-Trance
- **Drum & Bass**: Jungle y Drum & Bass
- **Dubstep**: Dubstep y variantes
- **Trap**: Trap y Future Bass

## 🔧 Configuración Avanzada

### Variables de Entorno

Crea un archivo `.env` para configuraciones personalizadas:

```env
PORT=3000
SCRAPING_DELAY=2000
MAX_CONCURRENT_PAGES=3
HEADLESS_MODE=true
```

### Personalizar User Agent

En `beatport-scraper.js`, puedes modificar el user agent:

```javascript
await page.setUserAgent('Tu-User-Agent-Personalizado');
```

## ⚠️ Consideraciones Importantes

### Términos de Servicio
- **Respeta los términos de servicio** de Beatport
- **Uso responsable**: No hagas scraping excesivo
- **Fines educativos**: Este software es para uso educativo y personal

### Limitaciones Técnicas
- **Dependiente de la estructura web**: Si Beatport cambia su HTML, el scraper necesitará actualizaciones
- **Rate Limiting**: Implementa delays para evitar ser bloqueado
- **Memoria**: El scraping consume recursos del sistema

### Recomendaciones
- **Ejecuta durante horas de bajo tráfico**
- **Prueba con un género primero** antes de extraer todos
- **Mantén actualizadas las dependencias**

## 🐛 Solución de Problemas

### Error: "No se pudieron extraer tracks"
- Verifica tu conexión a internet
- Beatport podría haber cambiado su estructura
- Intenta con un solo género primero

### Error de memoria
- Cierra otras aplicaciones
- Extrae géneros uno por uno
- Reinicia el servidor

### Páginas en blanco
- Verifica que Puppeteer esté instalado correctamente
- Prueba con `headless: false` para debug

## 📦 Estructura del Proyecto

```
ListMusic/
├── api/
│   ├── beatport-scraper.js    # Lógica principal de scraping
│   └── get-tracks.js          # Endpoints adicionales
├── public/
│   └── index.html             # Interfaz web
├── downloads/                 # Archivos CSV generados
├── package.json              # Dependencias del proyecto
├── server.js                 # Servidor Express
└── README.md                 # Este archivo
```

## 🔄 Actualizaciones

### Versión 1.0.0
- ✅ Scraping básico de Beatport
- ✅ Interfaz web responsive
- ✅ Generación de CSV
- ✅ Soporte para múltiples géneros

### Futuras mejoras
- 🔄 Cache de resultados
- 🔄 Programación de extracciones
- 🔄 Más formatos de exportación (JSON, Excel)
- 🔄 Integración con APIs de música

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia MIT. Ver archivo LICENSE para más detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Soporte

Si encuentras problemas o tienes sugerencias:

- Abre un issue en el repositorio
- Revisa la documentación
- Verifica las dependencias

---

**⚡ ¡Disfruta extrayendo las mejores listas de música electrónica de Beatport!**