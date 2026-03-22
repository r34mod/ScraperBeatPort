-- ============================================================
-- Supabase SQL Schema para ScraperBeatPort (con autenticación)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================
-- ⚠️  Si ya creaste las tablas sin user_id, ejecuta primero:
--    DROP TABLE IF EXISTS tracks;
--    DROP TABLE IF EXISTS scrape_sessions;
-- ============================================================

-- 1. Tabla de sesiones de scrape
CREATE TABLE IF NOT EXISTS scrape_sessions (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform     TEXT NOT NULL,
    genre        TEXT NOT NULL,
    tracks_count INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user     ON scrape_sessions (user_id);
CREATE INDEX idx_sessions_platform ON scrape_sessions (platform);
CREATE INDEX idx_sessions_genre    ON scrape_sessions (genre);
CREATE INDEX idx_sessions_created  ON scrape_sessions (created_at DESC);

-- 2. Tabla de tracks
CREATE TABLE IF NOT EXISTS tracks (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id   UUID REFERENCES scrape_sessions(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform     TEXT NOT NULL,
    genre        TEXT NOT NULL,
    position     INTEGER,
    title        TEXT NOT NULL,
    artist       TEXT NOT NULL,
    remixer      TEXT DEFAULT '',
    label        TEXT DEFAULT '',
    release_date TEXT,
    bpm          TEXT,
    key          TEXT,
    duration     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_user     ON tracks (user_id);
CREATE INDEX idx_tracks_session  ON tracks (session_id);
CREATE INDEX idx_tracks_platform ON tracks (platform);
CREATE INDEX idx_tracks_genre    ON tracks (genre);
CREATE INDEX idx_tracks_position ON tracks (position);

-- 3. Row Level Security — cada usuario solo accede a sus datos
ALTER TABLE scrape_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Sesiones
CREATE POLICY "Users read own sessions"
    ON scrape_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions"
    ON scrape_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions"
    ON scrape_sessions FOR DELETE USING (auth.uid() = user_id);

-- Tracks
CREATE POLICY "Users read own tracks"
    ON tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tracks"
    ON tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own tracks"
    ON tracks FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. Job Queue — tabla scrape_jobs
-- Soporta el patrón POST /api/jobs → POST /api/jobs/:id/run → GET /api/jobs/:id
-- ============================================================

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform    TEXT NOT NULL,
    genre       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'done', 'error')),
    result      JSONB,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_user       ON scrape_jobs (user_id);
CREATE INDEX idx_jobs_status     ON scrape_jobs (status);
CREATE INDEX idx_jobs_created    ON scrape_jobs (created_at DESC);

ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own jobs"
    ON scrape_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own jobs"
    ON scrape_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own jobs"
    ON scrape_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to jobs"
    ON scrape_jobs USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Suscripciones y límite de descargas diarias
-- ============================================================

-- Tabla de suscripciones (una fila por usuario)
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    subscribed         BOOLEAN NOT NULL DEFAULT FALSE,
    subscribed_at      TIMESTAMPTZ,
    stripe_session_id  TEXT
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- El usuario solo puede leer su propia fila
CREATE POLICY "Users read own subscription"
    ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Solo service_role puede insertar/actualizar (lo hace el webhook de Stripe)
CREATE POLICY "Service role manage subscriptions"
    ON user_subscriptions USING (auth.role() = 'service_role');

-- Tabla de conteo de descargas diarias
CREATE TABLE IF NOT EXISTS download_counts (
    id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date     DATE NOT NULL DEFAULT CURRENT_DATE,
    count    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_dl_counts_user_date ON download_counts (user_id, date);

ALTER TABLE download_counts ENABLE ROW LEVEL SECURITY;

-- Solo service_role gestiona los conteos (el backend usa supabaseAdmin)
CREATE POLICY "Service role manage download counts"
    ON download_counts USING (auth.role() = 'service_role');

