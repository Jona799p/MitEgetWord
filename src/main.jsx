import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

window.addEventListener('error', (e) => {
  console.error('Global window error:', e);
  const root = document.getElementById('root');
  if (root && root.childNodes.length === 0) {
    document.body.innerHTML = `<div style="background:#111;color:#ff6b6b;padding:30px;font-family:monospace;height:100vh;box-sizing:border-box;"><h2>⚠️ Global JavaScript Fejl:</h2><pre style="white-space:pre-wrap;color:#ff8787;">${e.error ? e.error.stack : e.message}</pre></div>`;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Global unhandled rejection:', e);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
