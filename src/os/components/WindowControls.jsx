import React, { useState, useEffect } from 'react';
import './WindowControls.css';

const WindowControls = ({ onMaximizedChange }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        setIsElectron(true);

        // Hent initial maksimeringsstatus
        ipcRenderer.invoke('window-is-maximized').then((maximized) => {
          setIsMaximized(Boolean(maximized));
          if (onMaximizedChange) onMaximizedChange(Boolean(maximized));
        }).catch(() => {});

        // Lyt til ændringer i maksimeringsstatus fra main-processen
        const handleMaxChange = (_, state) => {
          setIsMaximized(Boolean(state));
          if (onMaximizedChange) onMaximizedChange(Boolean(state));
        };

        ipcRenderer.on('window-maximized-state', handleMaxChange);

        return () => {
          ipcRenderer.removeListener('window-maximized-state', handleMaxChange);
        };
      } catch (err) {
        // Kører ikke i Electron
        setIsElectron(false);
      }
    }
  }, [onMaximizedChange]);

  const handleMinimize = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('window-minimize');
      } catch {}
    }
  };

  const handleMaximize = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('window-maximize').then((maximized) => {
          setIsMaximized(Boolean(maximized));
          if (onMaximizedChange) onMaximizedChange(Boolean(maximized));
        }).catch(() => {});
      } catch {}
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('window-close');
      } catch {}
    }
  };

  // Vis kun vindueskontroller hvis vi er i Electron (eller til visning)
  if (!isElectron && typeof window !== 'undefined' && !window.require) {
    return null;
  }

  return (
    <div className="window-controls" aria-label="Vinduesstyring">
      <button 
        type="button"
        className="window-control-btn minimize-btn" 
        onClick={handleMinimize} 
        title="Minimer"
        tabIndex={-1}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      <button 
        type="button"
        className="window-control-btn maximize-btn" 
        onClick={handleMaximize} 
        title={isMaximized ? "Gendan" : "Maksimer"}
        tabIndex={-1}
      >
        {isMaximized ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3.2 2H9.2V8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="1.8" y="3.2" width="6" height="6" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1.8" y="1.8" width="7.4" height="7.4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </button>

      <button 
        type="button"
        className="window-control-btn close-btn" 
        onClick={handleClose} 
        title="Luk"
        tabIndex={-1}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <line x1="1.8" y1="1.8" x2="9.2" y2="9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9.2" y1="1.8" x2="1.8" y2="9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};

export default WindowControls;
