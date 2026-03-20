/**
 * Validación centralizada de payloads para todos los endpoints POST.
 * Usa Zod para garantizar que los datos entrantes tengan los tipos
 * y formatos correctos antes de ejecutar cualquier lógica de negocio.
 */
const { z } = require('zod');

/**
 * Middleware factory: recibe un schema Zod y devuelve un middleware Express.
 * Si la validación falla, responde 400 con la lista de errores detallada.
 * Si pasa, substituye req.body por los datos parseados/coercionados de Zod.
 */
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Datos de entrada inválidos.',
                details: result.error.errors.map(e => ({
                    field: e.path.length ? e.path.join('.') : 'body',
                    message: e.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const schemas = {

    // POST /api/1001tracklists/scrape
    tracklistsScrape: z.object({
        searchType: z.enum(['dj', 'artist', 'event', 'popular'], {
            errorMap: () => ({ message: 'searchType debe ser: dj, artist, event o popular.' }),
        }),
        query: z.string().max(200).optional(),
        event: z.string().max(200).optional(),
    }),

    // POST /api/1001tracklists/tracks
    tracklistsGetTracks: z.object({
        tracklistUrl: z.string().url({ message: 'tracklistUrl debe ser una URL válida.' }),
    }),

    // POST /api/traxsource/scrape
    traxsourceScrape: z.object({
        genre: z.string().min(1).max(100),
    }),

    // POST /api/beatport/scrape-multiple
    beatportScrapeMultiple: z.object({
        genres: z
            .array(z.string().min(1).max(100))
            .min(1, { message: 'Debe proporcionar al menos un género.' })
            .max(20, { message: 'No se pueden procesar más de 20 géneros a la vez.' }),
    }),

    // POST /api/auth/register
    authRegister: z.object({
        email: z.string().email({ message: 'Email inválido.' }),
        password: z
            .string()
            .min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
            .max(128, { message: 'La contraseña no puede superar 128 caracteres.' }),
    }),

    // POST /api/auth/login
    authLogin: z.object({
        email: z.string().email({ message: 'Email inválido.' }),
        password: z.string().min(1).max(128),
    }),

    // POST /api/auth/refresh
    authRefresh: z.object({
        refresh_token: z.string().min(1, { message: 'refresh_token es requerido.' }),
    }),

    // POST /api/tracks/save
    tracksSave: z.object({
        tracks: z
            .array(
                z.object({
                    position:    z.number().int().min(1).max(1000).optional(),
                    title:       z.string().max(500).optional().default(''),
                    artist:      z.string().max(500).optional().default(''),
                    remixer:     z.string().max(200).optional(),
                    label:       z.string().max(200).optional(),
                    releaseDate: z.string().max(50).optional(),
                    release_date:z.string().max(50).optional(),
                    bpm:         z.number().optional(),
                    key:         z.string().max(20).optional(),
                    length:      z.string().max(20).optional(),
                    duration:    z.string().max(20).optional(),
                }).passthrough()   // conservar campos extra que pueda añadir un scraper
            )
            .min(1, { message: 'Se requiere al menos un track.' })
            .max(500, { message: 'No se pueden guardar más de 500 tracks a la vez.' }),
        platform:       z.string().min(1).max(50),
        genre:          z.string().min(1).max(100),
        replaceExisting: z.boolean().optional(),
    }),

    // POST /api/spotify/resolve
    spotifyResolve: z.object({
        url: z.string().url({ message: 'url debe ser una URL válida de Spotify.' }),
    }),

    // POST /api/youtube/search
    youtubeSearch: z.object({
        query:      z.string().min(1, { message: 'query es requerido.' }).max(300),
        maxResults: z.number().int().min(1).max(50).optional().default(5),
    }),
};

module.exports = { validate, schemas };
