/**
 * Subscription API
 *
 * Endpoints:
 *   GET  /api/subscription/status          — Plan del usuario + descargas restantes hoy
 *   POST /api/subscription/checkout        — Crea sesión Stripe Checkout (€1)
 *   POST /api/subscription/webhook         — Webhook de Stripe (raw body)
 *   POST /api/subscription/track-download  — Comprueba límite e incrementa contador
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin, isSupabaseEnabled } = require('./supabase');
const { requireAuth } = require('./auth-middleware');

const FREE_DOWNLOADS_PER_DAY = 5;
const PRICE_CENTS = 100; // €1.00

// ── Stripe lazy-init (no falla si no está configurado) ────────────────────────
let _stripe = null;
function getStripe() {
    if (!_stripe && process.env.STRIPE_SECRET_KEY) {
        _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return _stripe;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getSubscriptionStatus(userId) {
    if (!isSupabaseEnabled()) {
        return { subscribed: false, downloadsToday: 0, downloadsLeft: FREE_DOWNLOADS_PER_DAY };
    }

    const today = new Date().toISOString().split('T')[0];

    const [{ data: sub }, { data: countRow }] = await Promise.all([
        supabaseAdmin
            .from('user_subscriptions')
            .select('subscribed')
            .eq('user_id', userId)
            .maybeSingle(),
        supabaseAdmin
            .from('download_counts')
            .select('count')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle(),
    ]);

    const subscribed = sub?.subscribed === true;
    const downloadsToday = countRow?.count ?? 0;
    const downloadsLeft = subscribed ? null : Math.max(0, FREE_DOWNLOADS_PER_DAY - downloadsToday);

    return { subscribed, downloadsToday, downloadsLeft };
}

// ── GET /status ───────────────────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
    try {
        const status = await getSubscriptionStatus(req.userId);
        res.json(status);
    } catch (err) {
        console.error('Error en GET /subscription/status:', err);
        res.status(500).json({ error: 'Error obteniendo estado de suscripción.' });
    }
});

// ── POST /checkout ────────────────────────────────────────────────────────────
router.post('/checkout', requireAuth, async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ error: 'Pagos no están configurados en el servidor.' });
    }

    // Si ya está suscrito, no crear sesión
    if (isSupabaseEnabled()) {
        const { data: sub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('subscribed')
            .eq('user_id', req.userId)
            .maybeSingle();
        if (sub?.subscribed) {
            return res.status(400).json({ error: 'Ya tienes una suscripción activa.' });
        }
    }

    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            client_reference_id: req.userId,
            metadata: { userId: req.userId },
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Descarga Ilimitada — Music Scraper Hub',
                        description: 'Acceso ilimitado a descargas desde Tidal y YouTube. Pago único.',
                    },
                    unit_amount: PRICE_CENTS,
                },
                quantity: 1,
            }],
            success_url: `${origin}/tidal?sub=ok`,
            cancel_url:  `${origin}/tidal`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Error creando sesión Stripe:', err);
        res.status(500).json({ error: 'Error creando sesión de pago.' });
    }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
// IMPORTANTE: Se monta con express.raw() en server.js ANTES de express.json()
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(503).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send('Webhook secret not configured');

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;

        if (userId && isSupabaseEnabled()) {
            const { error } = await supabaseAdmin
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    subscribed: true,
                    subscribed_at: new Date().toISOString(),
                    stripe_session_id: session.id,
                }, { onConflict: 'user_id' });

            if (error) {
                console.error('Error guardando suscripción:', error);
            } else {
                console.log(`✅ Usuario suscrito: ${userId}`);
            }
        }
    }

    res.json({ received: true });
});

// ── POST /track-download ──────────────────────────────────────────────────────
// Verifica si el usuario puede descargar y, si puede, incrementa el contador.
// Respuesta: { allowed: bool, subscribed: bool, downloadsLeft: number|null }
router.post('/track-download', requireAuth, async (req, res) => {
    if (!isSupabaseEnabled()) {
        return res.json({ allowed: true, subscribed: false, downloadsLeft: null });
    }

    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Comprobar suscripción
        const { data: sub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('subscribed')
            .eq('user_id', userId)
            .maybeSingle();

        if (sub?.subscribed) {
            return res.json({ allowed: true, subscribed: true, downloadsLeft: null });
        }

        // Obtener contador del día
        const { data: existing } = await supabaseAdmin
            .from('download_counts')
            .select('count')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

        const current = existing?.count ?? 0;

        if (current >= FREE_DOWNLOADS_PER_DAY) {
            return res.json({ allowed: false, subscribed: false, downloadsLeft: 0 });
        }

        // Incrementar contador
        if (existing) {
            await supabaseAdmin
                .from('download_counts')
                .update({ count: current + 1 })
                .eq('user_id', userId)
                .eq('date', today);
        } else {
            await supabaseAdmin
                .from('download_counts')
                .insert({ user_id: userId, date: today, count: 1 });
        }

        return res.json({
            allowed: true,
            subscribed: false,
            downloadsLeft: FREE_DOWNLOADS_PER_DAY - (current + 1),
        });
    } catch (err) {
        console.error('Error en track-download:', err);
        res.status(500).json({ error: 'Error verificando límite de descargas.' });
    }
});

module.exports = router;
