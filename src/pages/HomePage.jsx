import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const [countdown, setCountdown] = useState('00:00:00');
  const titleRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = next - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setCountdown(`${h}:${m}:${s}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Title cycle
  useEffect(() => {
    const titles = ['WHEREVER', 'WHENEVER', 'HOWEVER'];
    let idx = 0;
    const id = setInterval(() => {
      if (titleRef.current) {
        titleRef.current.style.opacity = '0';
        setTimeout(() => {
          idx = (idx + 1) % titles.length;
          if (titleRef.current) {
            titleRef.current.textContent = titles[idx];
            titleRef.current.style.opacity = '1';
          }
        }, 500);
      }
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const platforms = [
    { icon: 'BP', name: 'Beatport', desc: 'La plataforma #1 en música electrónica mundial. House, Techno, Trance y todos los géneros que definen la escena underground y comercial.', to: '/beatport' },
    { icon: 'TS', name: 'Traxsource', desc: 'El hogar del House auténtico. Deep House, Soulful, Afro House y los sonidos más puros de la cultura underground.', to: '/traxsource' },
    { icon: 'TL', name: '1001Tracklists', desc: 'Descubre los setlists de los mejores DJs del planeta. Tracks exclusivos de festivales, clubs y radio shows.', to: '/1001tracklists' },
    { icon: 'VZ', name: 'Visualice', desc: 'Visualiza, selecciona y organiza tus tracks descargados. Crea listas personalizadas y escucha previews desde YouTube y SoundCloud.', to: '/visualice' },
  ];

  return (
    <div className="container">
      <header className="header">
        <div className="brand-section">
          <h1 className="brand-title">MUSIC SCRAPER</h1>
          <p className="brand-subtitle">WORLDWIDE</p>
        </div>
        <div className="hero-section">
          <h2 className="main-title" ref={titleRef} style={{ transition: 'opacity 0.5s' }}>WHEREVER</h2>
          <h3 className="subtitle">YOU ARE</h3>
          <p className="description">
            Conectamos el espíritu de la música electrónica con el mundo entero.
            Extrae datos de las mejores plataformas musicales desde cualquier lugar.
          </p>
        </div>
      </header>

      <section className="platforms-section">
        <h2 className="section-title">BEST OF MUSIC PLATFORMS</h2>
        <p className="section-subtitle">Explora las mejores fuentes de música electrónica</p>
        <div className="platforms-grid">
          {platforms.map(p => (
            <div className="platform-card" key={p.name}>
              <div className="platform-icon">{p.icon}</div>
              <h3 className="platform-name">{p.name}</h3>
              <p className="platform-description">{p.desc}</p>
              <Link to={p.to} className="platform-button">Explore</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="upcoming-section">
        <h2 className="section-title">COUNTDOWN TO</h2>
        <div className="countdown-timer">{countdown}</div>
        <p className="section-subtitle">Next scraping session</p>
      </section>

      <footer className="footer">
        <p className="footer-text">
          Music Scraper Hub · Extract · Music Scraper Hub · Extract · Music Scraper Hub · Extract
        </p>
      </footer>
    </div>
  );
}
