import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './languagesConfigs/i18n';
import { ThemeProvider } from './context/ThemeContext'; // <- import

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
