import React from 'react';
import './Desktop.css';

const Desktop = ({ onOpenApp }) => {
  return (
    <div className="desktop-container">
      <div className="desktop-grid">

        
        {/* Word Application Icon */}
        <div className="app-icon-wrapper" onClick={() => onOpenApp({ type: 'word-dashboard' })} style={{ cursor: 'pointer' }}>
          <div className="app-icon word-icon" style={{ backgroundColor: 'var(--primary-accent, #2b579a)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="9 9 12 15 15 9"></polyline>
            </svg>
          </div>
          <span className="app-name">Word</span>
        </div>

        {/* ImT Application Icon */}
        <div 
          className="app-icon-wrapper" 
          onClick={() => onOpenApp({ type: 'imt' })} 
          style={{ cursor: 'pointer' }}
          title="Åbn ImT (Billede til Tekst)"
        >
          <div className="app-icon imt-icon" style={{ backgroundColor: 'var(--primary-accent, #2b579a)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
              <path d="M7 8h10"></path>
              <path d="M12 8v8"></path>
              <path d="M9 16h6"></path>
            </svg>
          </div>
          <span className="app-name">ImT</span>
        </div>

        {/* Settings Application Icon */}
        <div 
          className="app-icon-wrapper" 
          onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))} 
          style={{ cursor: 'pointer' }}
          title="Åbn indstillinger (Ctrl+,)"
        >
          <div className="app-icon settings-icon" style={{ backgroundColor: '#2d3748', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <span className="app-name">Indstillinger</span>
        </div>
        
        {/* Placeholder for future apps */}
        <div className="app-icon-wrapper" style={{ opacity: 0.5 }}>
          <div className="app-icon notes-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
              <line x1="16" y1="8" x2="2" y2="22"></line>
              <line x1="17.5" y1="15" x2="9" y2="6.5"></line>
            </svg>
          </div>
          <span className="app-name">Noter (Kommer)</span>
        </div>
      </div>
    </div>
  );
};

export default Desktop;
