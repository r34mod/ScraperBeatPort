import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STATIONS } from '../data/stations';
import RadioTuner from '../components/RadioTuner';
import './HomePage.css';

// ── 3D Globe constants ────────────────────────────────────────────
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

const COUNTRY_COORDS = {
  PL: [52, 19],  ESP: [40, -4],  GR:  [39, 22],  AND: [42, 1.5],
  EN: [52, -2],  SR:  [44, 21],  RS:  [44, 21],  IT:  [42, 12],
  FR: [47, 2],   DK:  [56, 10],  HR:  [45, 16],  NL:  [52, 5],
  SK: [48, 19],  SL:  [46, 14],  SQ:  [41, 20],  LT:  [55, 24],
  LU: [50, 6],   NO:  [60, 10],  RU:  [55, 37],  DE:  [51, 10],
  UK: [52, -2],  SE:  [62, 16],  FI:  [62, 26],  IE:  [53, -8],
};

function buildGlobeDots() {
  const dots = [];
  let i = 0;
  for (const s of STATIONS) {
    const c = COUNTRY_COORDS[s.country];
    if (c) {
      const angle = i * 2.3999;
      const r = Math.sqrt(i + 1) * 1.8;
      const jLat = Math.cos(angle) * Math.min(r, 5.5);
      const jLon = Math.sin(angle) * Math.min(r, 7.5);
      dots.push([c[0] + jLat, c[1] + jLon]);
    }
    i++;
  }
  // World coverage extras
  const extra = [
    [40.7,-74],[48.9,2.3],[51.5,-0.1],[55.7,37.6],[41.9,12.5],
    [-23,-46.6],[-34,-58.4],[19,-99],[-33,151],[-26,28],
    [37,-122],[33,-118],[59,18],[60,25],[53,-6],[48,16],
    [25,55],[28,77],[35,139],[1,104],[14,121],[31,121],
    [6,3],[30,31],[-1,37],[4,15],[-15,-47],[56,-3],
    [43,44],[39,125],[36,128],[13,80],[-6,107],[24,54],
    [33,44],[31,35],[23,-102],[-8,-77],[-4,15],[-1,117],
    [14,-17],[-18,47],[10,7],[-33,-70],[4,-74],[10,-67],
    [-12,-77],[9,38],[15,32],[31,30],[34,9],[36,3],
  ];
  return dots.concat(extra);
}

const GLOBE_DOTS = buildGlobeDots();
const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

// ── Waveform heights for side panels ─────────────────────────────
const WAVE_L = [14,28,42,20,55,18,66,32,12,48,24,60,36,16,52,22,64,38,10,44,30,58,26,50,40,18,62,34,8,46,28,56,20,44,30];
const WAVE_R = [22,50,16,62,36,8,48,30,58,20,44,26,66,38,12,54,24,46,32,60,18,52,40,14,56,28,42,10,50,22,64,34,16,48,26];

function WaveformSidebar({ heights, side }) {
  return (
    <div className={`hp-sidebar hp-sidebar-${side}`}>
      <div className="hp-sidebar-icon">
        {side === 'left'
          ? <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="10" width="4" height="8" rx="1" fill="#00d4ff"/><rect x="8" y="6" width="4" height="16" rx="1" fill="#00d4ff"/><rect x="14" y="4" width="4" height="20" rx="1" fill="#00d4ff"/><rect x="20" y="8" width="4" height="12" rx="1" fill="#00d4ff"/></svg>
          : <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="#00d4ff" strokeWidth="1.5" fill="none"/><circle cx="14" cy="14" r="5" stroke="#00d4ff" strokeWidth="1.5" fill="none"/><circle cx="14" cy="14" r="2" fill="#00d4ff"/></svg>
        }
      </div>
      <div className="hp-wave-bars">
        {heights.map((h, i) => (
          <div
            key={i}
            className="hp-wave-bar"
            style={{
              '--h': `${h}px`,
              animationDelay: `${(i * 0.06) % 1.8}s`,
              animationDuration: `${0.7 + (i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Continent outlines [lat, lon] ────────────────────────────────
const CONTINENTS = [
  // North America
  { color: '#2d6e3e', points: [
    [71,-180],[60,-141],[56,-130],[48,-124],[40,-124],[37,-122],
    [32,-117],[22,-106],[15,-92],[20,-87],[22,-83],[25,-80],
    [35,-76],[40,-74],[45,-66],[50,-56],[55,-60],[60,-64],
    [65,-64],[70,-56],[72,-56],[74,-68],[76,-73],[72,-80],
    [66,-85],[60,-80],[52,-80],[50,-88],[52,-108],[58,-118],
    [60,-130],[66,-160],[71,-180],
  ]},
  // Greenland (ice)
  { color: '#c8d8f0', points: [
    [76,-73],[78,-42],[83,-22],[83,-40],[80,-52],[76,-73],
  ]},
  // South America
  { color: '#2d8040', points: [
    [12,-72],[10,-62],[6,-53],[2,-51],[0,-48],[-5,-38],
    [-16,-38],[-23,-43],[-35,-57],[-44,-65],[-52,-68],[-56,-68],
    [-52,-58],[-40,-63],[-24,-44],[-10,-38],[0,-48],[8,-60],[12,-72],
  ]},
  // Europe
  { color: '#3a7a4a', points: [
    [72,28],[68,28],[62,5],[53,4],[48,2],[44,-2],[36,-6],
    [36,2],[38,12],[44,8],[46,13],[47,20],[44,28],[48,38],
    [54,38],[57,34],[60,28],[65,24],[70,24],[72,28],
  ]},
  // Africa
  { color: '#4a7a28', points: [
    [37,-6],[37,10],[34,12],[30,32],[22,38],[12,44],
    [2,42],[-2,41],[-8,40],[-12,38],[-18,36],[-26,34],
    [-34,26],[-35,20],[-30,18],[-22,14],[-12,16],[-4,10],
    [3,2],[6,-4],[10,-16],[15,-17],[22,-17],[28,-13],
    [33,-8],[37,-6],
  ]},
  // Asia
  { color: '#2d7040', points: [
    [72,28],[72,50],[65,60],[58,68],[55,72],[50,78],[48,86],
    [54,86],[62,68],[68,56],[72,72],[70,112],[65,128],
    [58,140],[50,136],[46,138],[42,140],[38,140],[35,134],
    [32,122],[25,120],[22,116],[20,110],[16,108],[5,102],
    [1,104],[-2,108],[-6,106],[-8,116],[-2,126],[5,120],
    [10,110],[14,100],[22,92],[12,82],[8,78],[16,74],
    [22,60],[26,56],[28,48],[24,50],[18,54],[12,44],
    [22,38],[30,32],[34,36],[42,44],[48,58],[56,62],
    [60,60],[65,56],[68,44],[72,28],
  ]},
  // Australia
  { color: '#9a6e28', points: [
    [-14,136],[-12,130],[-14,126],[-18,122],[-22,114],
    [-26,114],[-32,116],[-34,120],[-34,124],[-36,138],
    [-38,142],[-38,146],[-32,152],[-28,154],[-24,152],
    [-20,148],[-16,146],[-14,136],
  ]},
  // New Zealand
  { color: '#3a6a30', points: [
    [-34,173],[-38,176],[-40,176],[-46,169],[-44,168],
    [-40,172],[-36,174],[-34,173],
  ]},
];

// Cloud patches [centerLat, centerLon, latRadius, lonRadius]
const CLOUD_PATCHES = [
  [52,10,7,22],[5,28,11,28],[-12,140,9,20],[46,-22,9,16],
  [-38,-55,11,18],[22,-98,9,16],[62,75,13,26],[-5,32,11,18],
  [34,148,7,13],[15,-68,7,14],[28,52,7,18],[-20,30,9,16],
  [55,-40,10,20],[-62,0,16,55],[-66,90,14,45],
];



function TrackChart({ points }) {
  const W = 230; const H = 95;
  const max = Math.max(...points); const min = Math.min(...points);
  const coords = points.map((y, i) => [
    (i / (points.length - 1)) * W,
    H - ((y - min) / (max - min || 1)) * (H - 12) - 6,
  ]);
  const poly = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${H} ${poly} ${W},${H}`;
  const labels = ['00:00','09:00','10:00','13:00','18:00'];
  const yLabels = [0,50,100,150,200,250];
  return (
    <div className="hp-chart">
      {/* Y axis labels */}
      <div className="hp-chart-ylabels">
        {yLabels.map(v => <span key={v}>{v}</span>)}
      </div>
      <div className="hp-chart-inner">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="hp-chart-svg">
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* Horizontal guide lines */}
          {[20,40,60,80].map(y => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
          ))}
          <polygon points={area} fill="url(#cg)"/>
          <polyline points={poly} fill="none" stroke="#00d4ff" strokeWidth="1.8" strokeLinejoin="round"/>
          {coords.filter((_, i) => i % 2 === 0).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="#00d4ff"/>
          ))}
        </svg>
        <div className="hp-chart-xlabels">
          {labels.map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}

const PLATFORMS = ['BEATPORT', 'TRAXSOURCE', '1001TRACKLISTS'];
const PLATFORM_LINKS = { 'BEATPORT': '/beatport', 'TRAXSOURCE': '/traxsource', '1001TRACKLISTS': '/1001tracklists' };

// ── Upcoming shows data ───────────────────────────────────────────
const UPCOMING_SHOWS = [
  {
    id: 1,
    dj: 'Main Room',
    show: 'New Techno Now',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'Techno',
    live: true,
    color: '#1a0a2a',
    accent: '#6c346c',
    img: null,
    url: 'https://soundcloud.com/soundcloud-mainroom/sets/techno-new-techno-now',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A801471273&color=%236c346c&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'New Techno Now: Techno · Main Room: Dance',
  },
  {
    id: 2,
    dj: 'Electro Posé',
    show: 'Afro House - 2026 Mix',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'Afro House',
    live: false,
    color: '#150505',
    accent: '#150505',
    img: null,
    url: 'https://soundcloud.com/electropose/sets/afro-house-2024-mix',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A1901558159&color=%23150505&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'Afro House - 2026 Mix · Electro Posé',
  },
  {
    id: 3,
    dj: 'The Peak',
    show: 'EDM Next: Level Up',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'EDM',
    live: false,
    color: '#1a0a2a',
    accent: '#6c346c',
    img: null,
    url: 'https://soundcloud.com/soundcloud-the-peak/sets/level-up-edm-next',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A728636178&color=%236c346c&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'EDM Next: Level Up · The Peak: EDM',
  },
  {
    id: 4,
    dj: 'Tale Giorgione',
    show: 'REGGETON 2026 MIX',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'Reggaeton',
    live: false,
    color: '#1a0a0a',
    accent: '#ff3d3d',
    img: null,
    url: 'https://soundcloud.com/tale-giorgione/sets/reggeton-2026-mix-reggaeton',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2178319835&color=%236c346c&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'REGGETON 2026 🔥🔥🔥 MIX REGGAETON 2025 · Tale Giorgione',
  },
  {
    id: 5,
    dj: 'M3TAMORS!K',
    show: 'HARDWAVE MEGA MIX',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'Hardwave',
    live: false,
    color: '#150505',
    accent: '#150505',
    img: null,
    url: 'https://soundcloud.com/isaac-sherwood/sets/hardwave-mega-mix',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2084131233&color=%23150505&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'HARDWAVE MEGA MIX · M3TAMORS!K',
  },
  {
    id: 6,
    dj: 'HKSRвиски',
    show: 'Another Rally house mix',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'House',
    live: false,
    color: '#150505',
    accent: '#150505',
    img: null,
    url: 'https://soundcloud.com/martin-gecler-28718172/sets/rally-house-thicker-mix',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A1838734482&color=%23150505&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'Another Rally house mix · HKSRвиски',
  },
  {
    id: 8,
    dj: 'Kevin Patrick',
    show: 'IBIZA Summer Mix 2025',
    venue: 'SoundCloud',
    time: 'NOW PLAYING',
    genre: 'Deep House / Tech House / Afrohouse',
    live: false,
    color: '#150505',
    accent: '#150505',
    img: null,
    url: 'https://soundcloud.com/user-972968419/sets/ibiza-summer-mix-2025-deep',
    embed: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A1976326144&color=%23150505&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true',
    embedLabel: 'IBIZA Summer Mix 2025 · Kevin Patrick',
  },
];

function UpcomingShows() {
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [current, setCurrent] = useState(0);
  const [showDrag, setShowDrag] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [activeEmbed, setActiveEmbed] = useState(null); // { embed, embedLabel, accent }
  const total = UPCOMING_SHOWS.length;

  const updateCurrent = () => {
    const el = trackRef.current;
    if (!el) return;
    const cardW = (el.firstChild?.offsetWidth || 300) + 12;
    setCurrent(Math.min(Math.round(el.scrollLeft / cardW), total - 1));
  };

  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const cardW = (el.firstChild?.offsetWidth || 300) + 12;
    el.scrollBy({ left: dir * cardW, behavior: 'smooth' });
    setTimeout(updateCurrent, 350);
  };

  const onMDown = (e) => {
    const el = trackRef.current;
    dragRef.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    setShowDrag(true);
  };
  const onMMove = (e) => {
    setDragPos({ x: e.clientX, y: e.clientY });
    if (!dragRef.current.active) return;
    const el = trackRef.current;
    const dx = (e.pageX - el.offsetLeft) - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    el.scrollLeft = dragRef.current.scrollLeft - dx * 1.2;
  };
  const onMUp = () => {
    dragRef.current.active = false;
    setShowDrag(false);
    updateCurrent();
  };

  return (
    <section className="hp-shows">
      <div
        className="hp-shows-track"
        ref={trackRef}
        onScroll={updateCurrent}
        onMouseDown={onMDown}
        onMouseMove={onMMove}
        onMouseUp={onMUp}
        onMouseLeave={onMUp}
      >
        {UPCOMING_SHOWS.map(s => (
          <a
            key={s.id}
            className="hp-show-card"
            href={s.embed ? undefined : s.url}
            target={s.embed ? undefined : '_blank'}
            rel={s.embed ? undefined : 'noopener noreferrer'}
            style={{ '--card-color': s.color, '--card-accent': s.accent }}
            onClick={e => {
              if (dragRef.current.moved) { e.preventDefault(); return; }
              if (s.embed) {
                e.preventDefault();
                setActiveEmbed({ embed: s.embed, embedLabel: s.embedLabel, accent: s.accent });
              }
            }}
            draggable={false}
          >
            <div
              className="hp-show-artwork"
              style={{ background: `linear-gradient(160deg, ${s.color} 0%, color-mix(in srgb, ${s.accent} 40%, ${s.color}) 100%)` }}
            >
              <span className="hp-show-initials-lg">{s.dj.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
              <span className="hp-show-link-icon">{s.embed ? '▶' : '↗'}</span>
              {s.live && <span className="hp-show-live-badge">● LIVE</span>}
              {s.embed && <span className="hp-show-sc-badge">SC</span>}
            </div>
            <div className="hp-show-overlay">
              <div className="hp-show-dj">{s.dj}</div>
              <div className="hp-show-name">{s.show}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Drag cursor bubble */}
      {showDrag && (
        <div className="hp-shows-drag" style={{ left: dragPos.x, top: dragPos.y }}>DRAG</div>
      )}

      {/* SoundCloud embed modal */}
      {activeEmbed && (
        <div className="hp-sc-modal" onClick={() => setActiveEmbed(null)}>
          <div className="hp-sc-modal-box" onClick={e => e.stopPropagation()}>
            <div className="hp-sc-modal-header" style={{ '--sc-accent': activeEmbed.accent }}>
              <span className="hp-sc-modal-label">{activeEmbed.embedLabel}</span>
              <button className="hp-sc-modal-close" onClick={() => setActiveEmbed(null)} aria-label="Cerrar">×</button>
            </div>
            <iframe
              width="100%"
              height="300"
              scrolling="no"
              frameBorder="no"
              allow="autoplay"
              src={activeEmbed.embed}
              title={activeEmbed.embedLabel}
            />
          </div>
        </div>
      )}

      {/* Footer: counter + arrows */}
      <div className="hp-shows-footer">
        <span className="hp-shows-counter">
          {String(current + 1).padStart(2, '0')} — {String(total).padStart(2, '0')}
        </span>
        <div className="hp-shows-arrows">
          <button className="hp-shows-arrow" onClick={() => scroll(-1)} aria-label="Anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="hp-shows-arrow" onClick={() => scroll(1)} aria-label="Siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [platformIdx, setPlatformIdx] = useState(0);
  const [trackCount, setTrackCount] = useState(22);
  const [trackCountR, setTrackCountR] = useState(151);
  const [titleFade, setTitleFade] = useState(true);
  const [search, setSearch] = useState('');
  const chartData = useMemo(() => [5, 28, 52, 78, 108, 138, 160, 185, 212, 240], []);

  const activeTracks = [
    { id: 1, art: 'linear-gradient(135deg,#2d5a7a,#4a8aaa)', icon: '🎵', title: 'Thevoltto - Shirt', platform: 'Beatport' },
    { id: 2, art: 'linear-gradient(135deg,#5a2d5a,#8a4a8a)', icon: '▶', title: 'Stopen - Rassis', platform: 'Beatport' },
  ];

  // Rotate platform label
  useEffect(() => {
    const id = setInterval(() => {
      setTitleFade(false);
      setTimeout(() => {
        setPlatformIdx(p => (p + 1) % PLATFORMS.length);
        setTitleFade(true);
      }, 350);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Animate track count
  useEffect(() => {
    const id = setInterval(() => {
      setTrackCount(n => n + Math.floor(Math.random() * 2));
      setTrackCountR(n => n + Math.floor(Math.random() * 3));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const currentPlatform = PLATFORMS[platformIdx];

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`${PLATFORM_LINKS[currentPlatform]}?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="hp-root">
      {/* Left waveform sidebar */}
      <WaveformSidebar heights={WAVE_L} side="left" />

      {/* Main content */}
      <main className="hp-main">
        {/* Hero */}
        <section className="hp-hero">
          
          <h1 className="hp-title">MUSIC SCRAPER</h1>
          <p className="hp-subtitle">WORLDWIDE</p>
        </section>

        {/* Live Radio Card — Ibiza Style */}
        <section className="hp-live-card">
          <div className="hp-live-bg">
            <img src="https://www.dropbox.com/scl/fi/bozhyqy2kss1fgqn2bqmk/IbizaVibesRadio.png?rlkey=cifib7q9pzd6ythh9s63qaa54&st=z55tcjbg&dl=1" alt="Ibiza Palms" aria-hidden="true" />
          </div>
          <div className="hp-live-content">
            <div className="hp-live-onair">ON AIR NOW</div>
            <div className="hp-live-title">BEST OF ELECTRONIC LIVE MUSIC</div>
            <div className="hp-live-artists">Various Artists</div>
            <div className="hp-live-btns">
              <a href="https://www.youtube.com/watch?v=zK5mjww6CFQ" target="_blank" rel="noopener" className="hp-live-btn hp-live-btn-main">Listen</a>
              <a href="#" target="_blank" rel="noopener" className="hp-live-btn hp-live-btn-secondary">Radio Shows</a>
            </div>
          </div>
        </section>

        {/* Events Near You */}
        <section className="hp-events-card">
          <div className="hp-events-header">
    
         
          </div>
          <iframe
            className="hp-events-iframe"
            src="https://velvetcake.soundcloud.com/banner/Madrid/This%20week"
          />
        </section>

        {/* Radio Tuner */}
        <RadioTuner />

        {/* Globe + Search */}
        <section className="hp-globe-section">
         
          <form className="hp-search-wrap" onSubmit={handleSearch}>
            <input
              className="hp-search"
              placeholder="BÚSQUEDA DE TENDENCIAS MUNDIALES"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="hp-search-btn" aria-label="Buscar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </form>
        </section>

        {/* Exploring */}
        <div className="hp-exploring">
          YOU ARE EXPLORING&nbsp;
          <Link
            to={PLATFORM_LINKS[currentPlatform]}
            className={`hp-platform-label${titleFade ? ' visible' : ''}`}
          >
            {currentPlatform}
          </Link>
        </div>

        {/* Upcoming Shows — below globe */}
        <UpcomingShows />

      </main>

      {/* Right waveform sidebar */}
      <WaveformSidebar heights={WAVE_R} side="right" />

      {/* Footer */}
      <footer className="hp-footer">
        <div className="hp-footer-ticker-wrap">
          <div className="hp-footer-ticker">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i}>LIVE RADIO · SCRAPPING · MUSIC · </span>
            ))}
          </div>
        </div>
        <div className="hp-footer-body">

          <nav className="hp-footer-nav">
            <div className="hp-footer-col">
              <div className="hp-footer-col-title">Shows</div>
              <a href="#">Radio Shows</a>
              <a href="#">Schedule</a>
              <a href="#">Music</a>
              <a href="#">Records</a>
            </div>
            <div className="hp-footer-col">
              <div className="hp-footer-col-title">Magazine</div>
              <a href="#">News</a>
              <a href="#">Events</a>
              <a href="#">Feel Ibiza</a>
              <a href="#">About us</a>
            </div>
            <div className="hp-footer-col">
              <div className="hp-footer-col-title">Social</div>
              <a href="#">Facebook</a>
              <a href="#">Instagram</a>
              <a href="#">Twitter</a>
              <a href="#">TikTok</a>
            </div>
            <div className="hp-footer-col">
              <div className="hp-footer-col-title">Music</div>
              <a href="#">Vimeo</a>
              <a href="#">YouTube</a>
              <a href="#">Sound Cloud</a>
              <a href="#">Mix Cloud</a>
              <a href="#">Spotify</a>
              <a href="#">Beatport</a>
            </div>
            <div className="hp-footer-col">
              <div className="hp-footer-col-title">Legals</div>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms + Conditions</a>
              <a href="#">Cookies</a>
            </div>
          </nav>
        </div>
        <div className="hp-footer-bottom">
          <span>@2026 by r34mod</span>
        </div>
      </footer>
    </div>
  );
}
