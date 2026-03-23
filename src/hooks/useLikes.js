import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook for managing liked songs.
 * Fetches the user's liked songs on mount (or when login state changes).
 * Provides helpers to toggle, add, and remove likes.
 */
export function useLikes() {
  const { isLoggedIn, getValidToken } = useAuth();
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLikes = useCallback(async () => {
    if (!isLoggedIn) { setLikes([]); return; }
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { setLikes([]); return; }
      const res = await fetch('/api/likes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch likes');
      const data = await res.json();
      setLikes(data.likes || []);
    } catch {
      setLikes([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, getValidToken]);

  // Fetch on mount and whenever login state changes
  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  const isLiked = useCallback((title, artist) => {
    return likes.some(l => l.title === title && l.artist === artist);
  }, [likes]);

  const getLikeId = useCallback((title, artist) => {
    return likes.find(l => l.title === title && l.artist === artist)?.id ?? null;
  }, [likes]);

  const addLike = useCallback(async ({ title, artist = '', artwork_url = '', sc_label = '' }) => {
    if (!isLoggedIn) return null;
    try {
      const token = await getValidToken();
      if (!token) return null;
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, artist, artwork_url, sc_label }),
      });
      if (!res.ok) throw new Error('Failed to add like');
      const data = await res.json();
      if (!data.duplicate) {
        setLikes(prev => [data.like, ...prev]);
      }
      return data.like;
    } catch {
      return null;
    }
  }, [isLoggedIn, getValidToken]);

  const removeLike = useCallback(async (id) => {
    if (!isLoggedIn) return;
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch(`/api/likes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove like');
      setLikes(prev => prev.filter(l => l.id !== id));
    } catch {}
  }, [isLoggedIn, getValidToken]);

  /**
   * Toggle like for a track. Returns `true` if liked, `false` if unliked.
   */
  const toggleLike = useCallback(async ({ title, artist = '', artwork_url = '', sc_label = '' }) => {
    const existingId = getLikeId(title, artist);
    if (existingId) {
      await removeLike(existingId);
      return false;
    } else {
      await addLike({ title, artist, artwork_url, sc_label });
      return true;
    }
  }, [getLikeId, addLike, removeLike]);

  return { likes, loading, fetchLikes, isLiked, getLikeId, addLike, removeLike, toggleLike };
}
