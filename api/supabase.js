/**
 * Módulo de configuración del cliente Supabase.
 * 
 * Requiere las siguientes variables de entorno:
 *   SUPABASE_URL  - URL del proyecto Supabase (ej. https://xxxx.supabase.co)
 *   SUPABASE_KEY  - Clave anon/public del proyecto Supabase
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  SUPABASE_URL o SUPABASE_KEY no están configuradas. La integración con Supabase estará deshabilitada.');
}

// Cliente "admin" (usa solo la clave anon; no tiene contexto de usuario)
const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

/**
 * Crea un cliente Supabase autenticado con el token JWT del usuario.
 * Esto hace que las políticas RLS apliquen sobre el user_id correcto.
 * @param {string} accessToken - JWT access_token del usuario logueado
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createUserClient(accessToken) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_KEY, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    });
}

/**
 * Comprueba si la conexión con Supabase está disponible.
 * @returns {boolean}
 */
function isSupabaseEnabled() {
    return supabase !== null;
}

module.exports = { supabase, createUserClient, isSupabaseEnabled };
