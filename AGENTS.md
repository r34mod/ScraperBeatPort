# Guía para el Agente de IA - Proyecto ScraperBeatPort

Este documento proporciona una guía para que un agente de IA entienda y trabaje con el proyecto ScraperBeatPort.

## 1. Resumen del Proyecto

**ScraperBeatPort** es una aplicación web diseñada para extraer (scrapear) información de listas de éxitos musicales, principalmente de sitios como Beatport, Traxsource y 1001Tracklists. La aplicación también integra una función para buscar los tracks extraídos en YouTube.

El objetivo principal es obtener los Top 100 de diversos géneros musicales, procesar esa información y presentarla al usuario, con la posibilidad de encontrar y visualizar los videos correspondientes.

## 2. Arquitectura y Tecnologías

El proyecto se basa en una arquitectura cliente-servidor simple:

-   **Backend**: Una API RESTful construida con **Node.js** y **Express.js**. Se encarga de toda la lógica de scraping y de servir los datos.
-   **Frontend**: Un conjunto de páginas HTML estáticas que consumen la API del backend para mostrar la información.
-   **Scraping**: Se utilizan las librerías **Puppeteer** (para renderizado de páginas dinámicas) y **Cheerio** (para parseo de HTML) para la extracción de datos.
-   **Búsqueda en YouTube**: Se usa la librería `googleapis` para interactuar con la API de YouTube Data.
-   **Entorno**: El proyecto está configurado para funcionar tanto en un entorno de desarrollo local como en despliegues en la plataforma **Vercel**.

### Dependencias Clave:

-   `express`: Framework para el servidor web.
-   `puppeteer`: Navegador headless para scraping.
-   `cheerio`: Parser de HTML para extraer datos.
-   `googleapis`: Cliente de Node.js para las APIs de Google (YouTube).
-   `cors`: Para habilitar el Cross-Origin Resource Sharing.
-   `nodemon`: Para reiniciar el servidor automáticamente en desarrollo.

## 3. Estructura del Proyecto

```
.
├── api/                  # Lógica del backend (servidor, scrapers, etc.)
│   ├── server.js         # Punto de entrada principal del servidor Express
│   ├── beatport-scraper-fixed.js # Lógica para scrapear Beatport
│   ├── traxsource-scraper.js # Lógica para scrapear Traxsource
│   ├── 1001tracklists-scraper.js # Lógica para scrapear 1001Tracklists
│   ├── youtube-search.js # Lógica para buscar en YouTube
│   └── ...
├── public/               # Archivos del frontend (cliente)
│   ├── index.html        # Página principal de la aplicación
│   ├── beatport.html     # Interfaz para el scraper de Beatport
│   ├── traxsource.html   # Interfaz para el scraper de Traxsource
│   └── ...
├── downloads/            # Directorio donde se guardan archivos (si aplica)
├── package.json          # Metadatos y dependencias del proyecto
├── vercel.json           # Configuración de despliegue en Vercel
└── README.md             # Documentación del proyecto
```

## 4. Flujo de Trabajo y Comandos

### Scripts Disponibles

-   `npm start`: Inicia el servidor en modo producción.
    -   Comando: `node api/server.js`
-   `npm run dev`: Inicia el servidor en modo desarrollo con `nodemon`, que reinicia el servidor ante cualquier cambio en los archivos.
    -   Comando: `nodemon api/server.js`

### Iniciar el Entorno de Desarrollo

1.  Asegúrate de tener Node.js instalado.
2.  Instala las dependencias: `npm install`
3.  Inicia el servidor en modo desarrollo: `npm run dev`
4.  El servidor estará disponible en `http://localhost:3000`.

## 5. Endpoints de la API

La API se sirve bajo el prefijo `/api`.

-   **Beatport Scraper**:
    -   `GET /api/scrape?url=<URL_BEATPORT>`: Extrae el Top 100 de una URL de género de Beatport.
-   **Traxsource Scraper**:
    -   `GET /api/traxsource/scrape?url=<URL_TRAXSOURCE>`: Extrae el Top 100 de Traxsource.
-   **1001Tracklists Scraper**:
    -   `GET /api/1001tracklists/scrape?url=<URL_1001TRACKLISTS>`: Extrae un tracklist.
-   **YouTube Search**:
    -   `GET /api/youtube/search?q=<QUERY>`: Busca un video en YouTube. El `QUERY` suele ser "Artista - Título".
-   **Health Check**:
    -   `GET /health`: Endpoint para verificar que el servidor está funcionando correctamente.

## 6. Tareas Comunes para el Agente

### Tarea: Modificar un Scraper

1.  **Identificar el archivo**: Localiza el scraper correspondiente en el directorio `api/` (p.ej., `beatport-scraper-fixed.js`).
2.  **Analizar la lógica**: El código utiliza `puppeteer` para obtener el HTML y `cheerio` para parsearlo. Busca los selectores CSS que se usan para encontrar los elementos (título, artista, etc.).
3.  **Realizar cambios**: Si la estructura de la web de origen ha cambiado, actualiza los selectores CSS en el código.
4.  **Probar**: Reinicia el servidor y prueba el endpoint del scraper modificado para asegurarte de que funciona como se espera.

### Tarea: Añadir un Nuevo Scraper

1.  **Crear el archivo**: Crea un nuevo archivo en `api/`, por ejemplo, `nuevo-scraper.js`.
2.  **Implementar la lógica**: Sigue el patrón de los otros scrapers, usando Express para crear el router, y `puppeteer`/`cheerio` para el scraping.
3.  **Integrar en el servidor**: En `api/server.js`, importa el nuevo scraper y móntalo en una nueva ruta.
    ```javascript
    // En api/server.js
    const nuevoScraper = require('./nuevo-scraper');
    app.use('/api/nuevo', nuevoScraper);
    ```
4.  **Crear la interfaz (opcional)**: Añade un nuevo archivo HTML en `public/` para interactuar con el nuevo endpoint.
