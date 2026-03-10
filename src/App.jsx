import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BeatportPage from './pages/BeatportPage';
import TraxsourcePage from './pages/TraxsourcePage';
import TracklistsPage from './pages/TracklistsPage';
import VisualizePage from './pages/VisualizePage';
import MisListasPage from './pages/MisListasPage';
import RadioPage from './pages/RadioPage';
import TidalDownloadPage from './pages/TidalDownloadPage';

export default function App() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={isLoggedIn ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<HomePage />} />
        <Route path="beatport" element={<BeatportPage />} />
        <Route path="traxsource" element={<TraxsourcePage />} />
        <Route path="1001tracklists" element={<TracklistsPage />} />
        <Route path="visualice" element={<VisualizePage />} />
        <Route path="mis-listas" element={<MisListasPage />} />
        <Route path="radio" element={<RadioPage />} />
        <Route path="tidal" element={<TidalDownloadPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
