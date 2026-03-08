import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { RadioProvider } from './context/RadioContext';
import InstallPWA from './components/InstallPWA';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';

// Register service worker with auto-update
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RadioProvider>
          <App />
          <InstallPWA />
        </RadioProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
