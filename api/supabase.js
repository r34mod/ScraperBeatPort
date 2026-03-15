/**
 * Módulo de configuración del cliente Supabase.
 * 
 * Requiere las siguientes variables de entorno:
 *   SUPABASE_URL         - URL del proyecto Supabase (ej. https://xxxx.supabase.co)
 *   SUPABASE_KEY         - Clave anon/public del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Clave service_role (opcional, para operaciones de servidor como Storage)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  SUPABASE_URL o SUPABASE_KEY no están configuradas. La integración con Supabase estará deshabilitada.');
}
if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_KEY no está configurada. Las operaciones de Storage (uploads) usarán la clave anon, lo que puede causar errores de permisos.');
}

// Cliente con clave anon (para auth y consultas RLS desde el servidor)
const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// Cliente admin con service_role key (bypassa RLS, uso exclusivo del servidor)
const supabaseAdmin = (SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_KEY))
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
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

module.exports = { supabase, supabaseAdmin, createUserClient, isSupabaseEnabled };
