/**
 * API de autenticación.
 *
 * Endpoints:
 *   POST /api/auth/register   - Crear cuenta con email + password
 *   POST /api/auth/login      - Iniciar sesión con email + password
 *   POST /api/auth/logout     - Cerrar sesión (invalida el token)
 *   GET  /api/auth/me         - Obtener usuario actual (requiere token)
 */

const express = require('express');
const router = express.Router();
const { supabase, isSupabaseEnabled } = require('./supabase');
const { requireAuth, MOCK_TOKEN } = require('./auth-middleware');

// ─── MODO MOCK (desarrollo local sin Supabase) ──────────────────────────────
if (!isSupabaseEnabled()) {
    console.warn('⚠️  Auth en MODO MOCK: cualquier email/password será aceptado.');

    router.post('/register', (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        res.json({
            success: true,
            message: 'Cuenta creada (mock).',
            user: { id: 'mock-user-id', email },
            session: { access_token: MOCK_TOKEN, refresh_token: 'mock-refresh', expires_at: Math.floor(Date.now() / 1000) + 86400 },
            needsConfirmation: false,
        });
    });

    router.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        res.json({
            success: true,
            user: { id: 'mock-user-id', email },
            session: { access_token: MOCK_TOKEN, refresh_token: 'mock-refresh', expires_at: Math.floor(Date.now() / 1000) + 86400 },
        });
    });

    router.post('/logout', (_req, res) => res.json({ success: true, message: 'Sesión cerrada (mock).' }));
    router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.userId } }));
    router.post('/refresh', (req, res) => {
        res.json({ success: true, session: { access_token: MOCK_TOKEN, refresh_token: 'mock-refresh', expires_at: Math.floor(Date.now() / 1000) + 86400 } });
    });

    module.exports = router;
    return;
}
// ─── FIN MODO MOCK ───────────────────────────────────────────────────────────

// ─── POST /register ──────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error('Error en registro:', error.message);
            return res.status(400).json({ error: error.message });
        }

        // Supabase puede requerir confirmación de email
        const needsConfirmation = !data.session;

        res.json({
            success: true,
            message: needsConfirmation
                ? 'Cuenta creada. Revisa tu email para confirmar.'
                : 'Cuenta creada exitosamente.',
            user: data.user ? { id: data.user.id, email: data.user.email } : null,
            session: data.session ? {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            } : null,
            needsConfirmation,
        });
    } catch (error) {
        console.error('Error en POST /register:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── POST /login ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Error en login:', error.message);
            return res.status(401).json({ error: error.message });
        }

        res.json({
            success: true,
            user: { id: data.user.id, email: data.user.email },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        });
    } catch (error) {
        console.error('Error en POST /login:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ─── POST /logout ────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
    try {
        // Sign out server-side (el cliente también debe borrar su token local)
        await supabase.auth.signOut();
        res.json({ success: true, message: 'Sesión cerrada.' });
    } catch (error) {
        console.error('Error en POST /logout:', error);
        res.status(500).json({ error: 'Error cerrando sesión.' });
    }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
    res.json({
        user: { id: req.userId },
    });
});

// ─── POST /refresh ───────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({ error: 'refresh_token es requerido.' });
        }

        const { data, error } = await supabase.auth.refreshSession({ refresh_token });
        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            success: true,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        });
    } catch (error) {
        console.error('Error en POST /refresh:', error);
        res.status(500).json({ error: 'Error refrescando sesión.' });
    }
});

module.exports = router;
