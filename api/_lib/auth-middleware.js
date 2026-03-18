/**
 * Middleware de autenticación para Express.
 *
 * Extrae el JWT del header Authorization y verifica el usuario con Supabase Auth.
 * Si es válido, adjunta req.user y req.supabaseUser (cliente autenticado).
 */

const { supabase, createUserClient, isSupabaseEnabled } = require('./supabase');

// Token fijo para modo mock (solo desarrollo local sin Supabase)
const MOCK_TOKEN = 'mock-dev-token';

/**
 * Middleware que requiere un usuario autenticado.
 * Agrega a req:
 *   req.userId       - UUID del usuario
 *   req.userClient   - SupabaseClient autenticado (para consultas con RLS)
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Modo mock: aceptar el token mock sin validar contra Supabase
    if (!isSupabaseEnabled()) {
        if (token === MOCK_TOKEN) {
            req.userId = 'mock-user-id';
            req.userClient = null;
            return next();
        }
        return res.status(401).json({ error: 'Token mock inválido.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.', details: error?.message });
        }

        req.userId = user.id;
        req.userClient = createUserClient(token);
        next();
    } catch (err) {
        console.error('Error verificando token:', err);
        return res.status(401).json({ error: 'Error verificando autenticación.' });
    }
}

/**
 * Middleware opcional: si hay token lo valida, si no, sigue sin usuario.
 * Útil para endpoints que funcionan con o sin auth.
 */
async function optionalAuth(req, res, next) {
    if (!isSupabaseEnabled()) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.replace('Bearer ', '');
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            req.userId = user.id;
            req.userClient = createUserClient(token);
        }
    } catch (_) { /* silently continue */ }
    next();
}

module.exports = { requireAuth, optionalAuth, MOCK_TOKEN };
