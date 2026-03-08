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
