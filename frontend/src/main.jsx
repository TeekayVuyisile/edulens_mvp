import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/theme.scss';
import './styles/global.css';
import './styles/components.css';
import './styles/ui-kit.css';
import './styles/classroom.css';
import App from './App.jsx';
import { wakeServer } from './lib/serverStatus';

// Start waking the API (free hosting sleeps when idle) before anything asks it for data.
wakeServer();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
