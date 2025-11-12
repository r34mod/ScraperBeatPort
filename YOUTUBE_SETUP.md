# Configuración de la API de YouTube

## Configuración Opcional

La nueva funcionalidad de búsqueda de YouTube funciona en tres niveles:

1. **API de YouTube (Opcional - Requiere configuración)**
2. **Base de datos local de tracks (Funciona sin configuración)**
3. **Videos de fallback (Siempre funciona)**

## Configuración de la API de YouTube (Opcional)

Si quieres usar la API oficial de YouTube para búsquedas más precisas, sigue estos pasos:

### 1. Obtener API Key

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la "YouTube Data API v3"
4. Ve a "Credenciales" y crea una "API Key"
5. Opcionalmente, restringe la key solo a la YouTube Data API

### 2. Configurar la Variable de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
YOUTUBE_API_KEY=tu_api_key_aqui
```

### 3. Instalar Dependencias

```bash
npm install
```

## Uso Sin Configuración

El sistema funciona perfectamente sin configurar la API de YouTube:

- **Primera opción**: Busca en la base de datos local de tracks populares
- **Segunda opción**: Usa videos de fallback por género
- **Tercera opción**: Video genérico de música electrónica

## Funcionalidades

### Con API de YouTube configurada:
- ✅ Búsquedas reales de YouTube
- ✅ Resultados más precisos
- ✅ Información detallada de videos
- ✅ Múltiples opciones por búsqueda

### Sin API de YouTube (Funciona sin configuración):
- ✅ Base de datos de tracks populares
- ✅ Videos organizados por género
- ✅ Fallback automático
- ✅ Experiencia consistente

## Estructura del Endpoint

### POST /api/youtube/search
```json
{
  "query": "artist name song title",
  "maxResults": 5
}
```

**Respuesta:**
```json
{
  "success": true,
  "query": "artist name song title",
  "results": [
    {
      "videoId": "abc123",
      "title": "Song Title",
      "channelTitle": "Artist Name",
      "thumbnail": "https://...",
      "source": "youtube_api"
    }
  ]
}
```

### GET /api/youtube/video/:videoId
Obtiene información detallada de un video específico.

## Troubleshooting

### Error: "YouTube API key not configured"
- El sistema usa automáticamente la base de datos local
- No afecta la funcionalidad básica

### Error: "API request failed"
- Verifica que la API key sea correcta
- Asegúrate de que la YouTube Data API esté habilitada
- Revisa los límites de quota de la API

### Error: "This video is unavailable"
- YouTube restringe algunos embeds
- El sistema automáticamente prueba videos alternativos
- Siempre hay videos de fallback disponibles

## Base de Datos de Tracks

El sistema incluye una base de datos local con videos populares de estos géneros:

- House & Deep House
- Techno & Tech House  
- Trance & Progressive Trance
- Progressive House
- Ambient & Chill
- Artistas populares (Martin Garrix, Avicii, deadmau5, etc.)

Esta base de datos se actualiza regularmente y funciona sin configuración externa.