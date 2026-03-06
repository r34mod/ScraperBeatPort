import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const { save } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');

  const API = window.location.origin;

  const showMsg = (text, type = 'error') => setMsg({ text, type });
  const hideMsg = () => setMsg({ text: '', type: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    hideMsg();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');
      save(data);
      navigate('/');
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    hideMsg();
    if (regPass !== regPass2) { showMsg('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), password: regPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear cuenta');
      if (data.needsConfirmation) {
        showMsg('Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.', 'success');
      } else {
        save(data);
        navigate('/');
      }
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="background-orbs">
        <div className="orb orb-login-1" />
        <div className="orb orb-login-2" />
      </div>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/images/icon.PNG" alt="Logo" />
            <h1>Music Scraper Hub</h1>
            <p>Accede a tus listas de canciones</p>
          </div>

          {/* Tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); hideMsg(); }}
            >
              Iniciar Sesión
            </button>
            <button
              className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => { setTab('register'); hideMsg(); }}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Message */}
          {msg.text && (
            <div className={`auth-message ${msg.type}`}>{msg.text}</div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="tu@email.com" required autoComplete="email"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" placeholder="••••••••" required autoComplete="current-password" minLength={6}
                  value={loginPass} onChange={e => setLoginPass(e.target.value)} />
              </div>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? <><span className="spinner-inline" />Espera...</> : 'Entrar'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="tu@email.com" required autoComplete="email"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" placeholder="Mínimo 6 caracteres" required autoComplete="new-password" minLength={6}
                  value={regPass} onChange={e => setRegPass(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input type="password" placeholder="Repite la contraseña" required autoComplete="new-password" minLength={6}
                  value={regPass2} onChange={e => setRegPass2(e.target.value)} />
              </div>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? <><span className="spinner-inline" />Espera...</> : 'Crear Cuenta'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <span style={{ color: '#666', fontSize: '0.8rem' }}>Music Scraper Hub © 2025</span>
          </div>
        </div>
      </div>
    </div>
  );
}
