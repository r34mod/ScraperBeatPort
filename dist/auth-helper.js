/**
 * Shared Auth helper — included by all pages.
 * Uses localStorage key 'msh_session' to persist the Supabase auth payload.
 */
const Auth = {
    KEY: 'msh_session',
    save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },
    get() { try { return JSON.parse(localStorage.getItem(this.KEY)); } catch { return null; } },
    clear() { localStorage.removeItem(this.KEY); },
    getToken() { const s = this.get(); return s?.session?.access_token || null; },
    getEmail() { const s = this.get(); return s?.user?.email || ''; },
    isLoggedIn() { return !!this.getToken(); },
};

/**
 * Updates nav-actions area to show login link or user email + logout.
 * Expects elements with ids: navUserEmail, navLogout, navLoginLink
 */
function initAuthNav() {
    const $email  = document.getElementById('navUserEmail');
    const $logout = document.getElementById('navLogout');
    const $login  = document.getElementById('navLoginLink');

    if (Auth.isLoggedIn()) {
        if ($email) { $email.textContent = Auth.getEmail(); $email.style.display = 'inline'; }
        if ($logout) { $logout.style.display = 'inline-block'; $logout.addEventListener('click', () => { Auth.clear(); window.location.reload(); }); }
        if ($login) $login.style.display = 'none';
    } else {
        if ($email) $email.style.display = 'none';
        if ($logout) $logout.style.display = 'none';
        if ($login) $login.style.display = 'inline-block';
    }
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', initAuthNav);
