import React, { useState, useRef, useEffect, useCallback } from 'react';
import Desktop from './os/pages/Desktop';

import AIPill from './os/components/AIPill';
import SettingsModal from './os/components/SettingsModal';
import UpdateNotification from './os/components/UpdateNotification';
import PanelTitle from './os/components/PanelTitle';
import { WordApplication, WordDashboard } from './apps/WordApplication';
import { ImTApplication, setImTOpen } from './apps/ImTApplication';
import { getDocument } from './store/documentStore';
import { getSettings, applyTheme } from './store/settingsStore';
import './App.css'; 

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL RUNTIME ERROR in component:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 30, color: '#ff6b6b', backgroundColor: '#111111', height: '100%', overflow: 'auto', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ff4d4f' }}>⚠️ Fejl under åbning af visning / dokument:</h2>
          <div style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4d4f', borderRadius: 8, padding: 16, margin: '16px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ff7875', marginBottom: 8 }}>
              {this.state.error?.toString()}
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#d9d9d9', maxHeight: 300, overflow: 'auto' }}>
              {this.state.error?.stack}
            </pre>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{ padding: '8px 16px', background: '#4a90e2', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
          >
            Prøv igen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('appearance');
  const openSettings = (tab = 'appearance') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // Initialiser tema ved opstart og lyt efter genvejstast / events
  useEffect(() => {
    const s = getSettings();
    applyTheme(s.theme, s.accentColor);

    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('set-update-url', getServerUrl());
      } catch {}
    }

    const handleOpenSettingsEvent = (e) => {
      if (e?.detail?.tab) {
        setSettingsTab(e.detail.tab);
      }
      setIsSettingsOpen(true);
    };
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };

    window.addEventListener('openSettings', handleOpenSettingsEvent);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('openSettings', handleOpenSettingsEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [panels, setPanels] = useState([
    { id: 'panel-1', width: 100, stack: [{ type: 'desktop' }], forwardStack: [] }
  ]);
  const [activePanelId, setActivePanelId] = useState('panel-1');
  const activePanelIdRef = useRef(activePanelId);
  useEffect(() => {
    activePanelIdRef.current = activePanelId;
  }, [activePanelId]);

  // Hold ImT åben-tilstand synkroniseret med om ImT er synligt i mindst ét panel
  useEffect(() => {
    const isAnyImTOpen = panels.some(p => {
      const top = p.stack[p.stack.length - 1];
      return top?.type === 'imt';
    });
    setImTOpen(isAnyImTOpen);
  }, [panels]);

  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef(null);
  const panelRefs = useRef({});
  const rafRef = useRef(null);
  const latestWidthsRef = useRef(null);
  const workspaceRef = useRef(null);

  const handleOpenApp = (panelId, appData) => {
    setPanels(prev => prev.map(p => {
      if (p.id === panelId) {
        return { 
          ...p, 
          stack: [...p.stack, appData],
          forwardStack: [] // Nulstil fremad-stakken ved ny navigation
        };
      }
      return p;
    }));
    setActivePanelId(panelId);
  };

  const handleGoBack = useCallback((panelId) => {
    const targetId = panelId || activePanelIdRef.current;

    // Hvis indstillinger-modal er åben, luk den først
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }

    // Udsend event så aktive komponenter (f.eks. modaler eller mapper i Word/Dashboard) kan håndtere det først
    const backEvent = new CustomEvent('os:navigate-back', {
      cancelable: true,
      detail: { panelId: targetId }
    });
    const handled = !window.dispatchEvent(backEvent);
    if (handled) {
      return;
    }

    setPanels(prev => prev.map(p => {
      if (p.id === targetId) {
        if (p.stack.length <= 1) return p;
        const newStack = [...p.stack];
        const popped = newStack.pop();
        const newForwardStack = p.forwardStack ? [...p.forwardStack, popped] : [popped];
        return { ...p, stack: newStack, forwardStack: newForwardStack };
      }
      return p;
    }));
  }, [isSettingsOpen]);

  const handleGoForward = useCallback((panelId) => {
    const targetId = panelId || activePanelIdRef.current;

    const fwdEvent = new CustomEvent('os:navigate-forward', {
      cancelable: true,
      detail: { panelId: targetId }
    });
    const handled = !window.dispatchEvent(fwdEvent);
    if (handled) {
      return;
    }

    setPanels(prev => prev.map(p => {
      if (p.id === targetId) {
        if (!p.forwardStack || p.forwardStack.length === 0) return p;
        const newForwardStack = [...p.forwardStack];
        const nextView = newForwardStack.pop();
        return {
          ...p,
          stack: [...p.stack, nextView],
          forwardStack: newForwardStack
        };
      }
      return p;
    }));
  }, []);

  const handleGoBackRef = useRef(handleGoBack);
  handleGoBackRef.current = handleGoBack;

  const handleGoForwardRef = useRef(handleGoForward);
  handleGoForwardRef.current = handleGoForward;

  const lastNavTimeRef = useRef(0);

  const triggerNav = useCallback((direction, clientX, clientY) => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < 200) {
      return;
    }
    lastNavTimeRef.current = now;

    let targetId = activePanelIdRef.current;
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      const el = document.elementFromPoint(clientX, clientY);
      const panelEl = el ? el.closest('.os-panel') : null;
      if (panelEl) {
        const pId = panelEl.getAttribute('data-panel-id');
        if (pId) {
          targetId = pId;
          setActivePanelId(pId);
        }
      }
    }

    if (direction === 'back') {
      handleGoBackRef.current(targetId);
    } else {
      handleGoForwardRef.current(targetId);
    }
  }, []);

  // Lyt på museknapper på siden (Knap 3 = Tilbage, Knap 4 = Fremad), Alt+Pile og Electron IPC
  useEffect(() => {
    const isNavMouseButton = (e) => {
      // e.button: 3 = Tilbage, 4 = Fremad
      // e.which: 4 = Tilbage, 5 = Fremad
      return e.button === 3 || e.button === 4 || e.which === 4 || e.which === 5;
    };

    const getNavDirection = (e) => {
      if (e.button === 3 || e.which === 4) return 'back';
      if (e.button === 4 || e.which === 5) return 'forward';
      return null;
    };

    // Forhindr browserens standardhistorik-hop på nedtryk
    const handlePointerDown = (e) => {
      if (isNavMouseButton(e)) {
        e.preventDefault();
      }
    };

    // Udfør navigation ved slip (pointerup, mouseup eller auxclick)
    const handleNavTrigger = (e) => {
      if (isNavMouseButton(e)) {
        e.preventDefault();
        e.stopPropagation();
        const dir = getNavDirection(e);
        if (dir) {
          triggerNav(dir, e.clientX, e.clientY);
        }
      }
    };

    const handleKeyDownNav = (e) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        triggerNav('back');
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        triggerNav('forward');
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('mousedown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handleNavTrigger, { capture: true });
    window.addEventListener('mouseup', handleNavTrigger, { capture: true });
    window.addEventListener('auxclick', handleNavTrigger, { capture: true });
    window.addEventListener('keydown', handleKeyDownNav);

    let cleanupIpc = null;
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const onIpcBack = () => triggerNav('back');
        const onIpcForward = () => triggerNav('forward');

        ipcRenderer.on('app-navigate-back', onIpcBack);
        ipcRenderer.on('app-navigate-forward', onIpcForward);

        cleanupIpc = () => {
          ipcRenderer.removeListener('app-navigate-back', onIpcBack);
          ipcRenderer.removeListener('app-navigate-forward', onIpcForward);
        };
      } catch (err) {
        // Ignorer fejl hvis ikke Electron
      }
    }

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('mousedown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handleNavTrigger, { capture: true });
      window.removeEventListener('mouseup', handleNavTrigger, { capture: true });
      window.removeEventListener('auxclick', handleNavTrigger, { capture: true });
      window.removeEventListener('keydown', handleKeyDownNav);
      if (cleanupIpc) cleanupIpc();
    };
  }, [triggerNav]);

  const handleSplitPanel = (panelId) => {
    setPanels(prev => {
      const index = prev.findIndex(p => p.id === panelId);
      if (index === -1) return prev;
      
      const newPanels = [...prev];
      const oldPanel = newPanels[index];
      const newWidth = oldPanel.width / 2;
      
      newPanels[index] = { ...oldPanel, width: newWidth };
      newPanels.splice(index + 1, 0, {
        id: `panel-${Date.now()}`,
        width: newWidth,
        stack: [{ type: 'desktop' }],
        forwardStack: []
      });
      
      return newPanels;
    });
  };

  const handleClosePanel = (panelId) => {
    setPanels(prev => {
      if (prev.length <= 1) return prev;
      
      const index = prev.findIndex(p => p.id === panelId);
      if (index === -1) return prev;
      
      const newPanels = [...prev];
      const closedWidth = newPanels[index].width;
      newPanels.splice(index, 1);
      
      const neighborIndex = index > 0 ? index - 1 : 0;
      newPanels[neighborIndex].width += closedWidth;
      
      return newPanels;
    });
  };

  const handleMouseDown = (e, index) => {
    e.preventDefault();
    setIsDragging(true);
    const container = workspaceRef.current || document.body;
    const containerWidth = container.clientWidth || window.innerWidth;
    const initialWidths = panels.map(p => p.width);
    dragInfo.current = {
      startX: e.clientX,
      index: index, 
      leftId: panels[index]?.id,
      rightId: panels[index + 1]?.id,
      initialWidths: initialWidths,
      containerWidth: containerWidth
    };
    latestWidthsRef.current = null;
  };

  useEffect(() => {
    if (!isDragging) return;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!dragInfo.current) return;
      const { startX, index, leftId, rightId, initialWidths, containerWidth } = dragInfo.current;
      const deltaX = e.clientX - startX;
      const deltaPercentage = (deltaX / containerWidth) * 100;
      
      const leftIndex = index;
      const rightIndex = index + 1;
      
      const totalCombinedWidth = initialWidths[leftIndex] + initialWidths[rightIndex];
      const minPercent = 12; // Minimum 12% bredde per panel for at forhindre sammenbrud
      const maxPercent = totalCombinedWidth - minPercent;
      
      let newLeftWidth = initialWidths[leftIndex] + deltaPercentage;
      newLeftWidth = Math.max(minPercent, Math.min(maxPercent, newLeftWidth));
      let newRightWidth = totalCombinedWidth - newLeftWidth;

      const updated = [...initialWidths];
      updated[leftIndex] = newLeftWidth;
      updated[rightIndex] = newRightWidth;

      // Opdater altid referencen så animationFrame ALTID bruger den allernyeste museposition
      latestWidthsRef.current = {
        leftId: leftId,
        rightId: rightId,
        newLeft: newLeftWidth,
        newRight: newRightWidth,
        updated
      };

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const data = latestWidthsRef.current;
          if (!data) return;
          const leftEl = data.leftId ? panelRefs.current[data.leftId] : null;
          const rightEl = data.rightId ? panelRefs.current[data.rightId] : null;
          if (leftEl) {
            leftEl.style.width = `${data.newLeft}%`;
            leftEl.style.flex = `0 0 ${data.newLeft}%`;
            leftEl.style.maxWidth = `${data.newLeft}%`;
          }
          if (rightEl) {
            rightEl.style.width = `${data.newRight}%`;
            rightEl.style.flex = `0 0 ${data.newRight}%`;
            rightEl.style.maxWidth = `${data.newRight}%`;
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const data = latestWidthsRef.current;
      if (data && data.updated) {
        setPanels(prev => prev.map((p, i) => ({
          ...p,
          width: data.updated[i] !== undefined ? data.updated[i] : p.width
        })));
      }
      setIsDragging(false);
      dragInfo.current = null;
      latestWidthsRef.current = null;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleMouseUp();
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { capture: true, passive: false });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging]);



  useEffect(() => {
    const handleOpenDoc = async (e) => {
      const docId = e.detail;
      if (!docId) return;
      try {
        const doc = await getDocument(docId);
        if (doc) {
          handleOpenApp(activePanelId, {
            type: 'word',
            docId: doc.id,
            title: doc.title,
            fileData: doc.content,
            folderId: doc.folderId || null
          });
        }
      } catch (err) {
        console.error('Kunne ikke åbne dokument globalt:', err);
      }
    };

    window.addEventListener('openDocumentGlobal', handleOpenDoc);
    return () => window.removeEventListener('openDocumentGlobal', handleOpenDoc);
  }, [activePanelId]);

  const renderView = (panelId, view) => {
    window.activePanelId = activePanelId; 
    
    switch (view.type) {
      case 'desktop':
        return <Desktop onOpenApp={(data) => handleOpenApp(panelId, data)} />;

      case 'word-dashboard':
        return (
          <WordDashboard 
            panelId={panelId}
            onOpenDocument={(doc) => handleOpenApp(panelId, {
              type: 'word',
              docId: doc.id,
              title: doc.title,
              fileData: doc.content,
              folderId: doc.folderId || null
            })}
          />
        );

      case 'word':
        return (
          <ErrorBoundary>
            <WordApplication 
              appId={panelId}
              isActive={activePanelId === panelId}
              onClose={() => handleGoBack(panelId)}
              onMinimize={() => {}} // No-op in this tiling OS
              onMaximize={() => {}} // No-op in this tiling OS
              docId={view.docId}
              docTitle={view.title}
              fileData={view.fileData || null}
              folderId={view.folderId || null}
              onTitleChange={(newTitle) => {
                setPanels(prev => prev.map(p => {
                  if (p.id === panelId) {
                    const newStack = [...p.stack];
                    const current = newStack[newStack.length - 1];
                    if (current && current.type === 'word') {
                      newStack[newStack.length - 1] = { ...current, title: newTitle };
                    }
                    return { ...p, stack: newStack };
                  }
                  return p;
                }));
              }}
              onSave={(content, newTitle) => {
                // Only trigger top-level panel re-render if the title actually changed (e.g. rename)
                // This prevents re-rendering the entire desktop during continuous background auto-saves
                if (newTitle) {
                  setPanels(prev => {
                    const panel = prev.find(p => p.id === panelId);
                    const current = panel?.stack[panel.stack.length - 1];
                    if (current && current.type === 'word' && current.title !== newTitle) {
                      return prev.map(p => {
                        if (p.id === panelId) {
                          const newStack = [...p.stack];
                          newStack[newStack.length - 1] = { ...current, title: newTitle, fileData: content };
                          return { ...p, stack: newStack };
                        }
                        return p;
                      });
                    }
                    return prev;
                  });
                }
              }}
            />
          </ErrorBoundary>
        );

      case 'imt':
        return (
          <ErrorBoundary>
            <ImTApplication 
              panelId={panelId}
              onClose={() => handleGoBack(panelId)}
            />
          </ErrorBoundary>
        );

      default:
        return <div>Unknown App</div>;
    }
  };

  return (
    <div 
      ref={workspaceRef}
      className={`os-workspace ${isDragging ? 'is-resizing' : ''}`} 
      style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}
    >
      {panels.map((panel, index) => {
        const currentView = panel.stack[panel.stack.length - 1];
        
        return (
          <React.Fragment key={panel.id}>
            <div 
              ref={el => { panelRefs.current[panel.id] = el; }}
              className={`os-panel ${activePanelId === panel.id ? 'active' : ''}`}
              data-panel-id={panel.id}
              style={{ 
                width: `${panel.width}%`, 
                flex: `0 0 ${panel.width}%`,
                maxWidth: `${panel.width}%`,
                minWidth: 0,
                position: 'relative', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%' 
              }}
              onMouseDownCapture={() => setActivePanelId(panel.id)}
            >
              <div className="os-panel-header">
                <button 
                  className="os-icon-btn back-btn" 
                  onClick={() => handleGoBack(panel.id)} 
                  disabled={panel.stack.length <= 1} 
                  title="Gå tilbage (Tilbage-museknap / Alt + Venstre pil)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>

                <button 
                  className="os-icon-btn forward-btn" 
                  onClick={() => handleGoForward(panel.id)} 
                  disabled={!panel.forwardStack || panel.forwardStack.length === 0} 
                  title="Gå fremad (Fremad-museknap / Alt + Højre pil)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                
                <div className="os-panel-title">
                  {currentView.type === 'desktop' 
                    ? 'Skrivebord' 
                    : currentView.type === 'word-dashboard' 
                    ? 'Word - Dokumenter' 
                    : currentView.type === 'word' 
                    ? (currentView.title || 'Word') 
                    : currentView.type === 'imt'
                    ? 'ImT - Billede til Tekst'
                    : 'App'}
                </div>
                
                <button className="os-icon-btn" onClick={openSettings} title="Indstillinger">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
                
                <button className="os-icon-btn" onClick={() => handleSplitPanel(panel.id)} title="Åbn side-om-side vindue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
                </button>
                
                {panels.length > 1 && (
                  <button className="os-icon-btn danger" onClick={() => handleClosePanel(panel.id)} title="Luk vindue">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>
              
              <div className="os-panel-content" style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {renderView(panel.id, currentView)}
              </div>
            </div>

            {index < panels.length - 1 && (
              <div 
                className={`os-splitter ${isDragging && dragInfo.current?.index === index ? 'dragging' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, index)}
              ></div>
            )}
          </React.Fragment>
        );
      })}

      {isDragging && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 999999, 
            cursor: 'col-resize', 
            userSelect: 'none',
            pointerEvents: 'all'
          }} 
        />
      )}
      
      {(() => {
        const activePanel = panels.find(p => p.id === activePanelId);
        const activeView = activePanel ? activePanel.stack[activePanel.stack.length - 1] : null;
        const isDashboardMode = activeView && (activeView.type === 'desktop' || activeView.type === 'word-dashboard');
        return <AIPill isDashboard={isDashboardMode} />;
      })()}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialTab={settingsTab} />
      <UpdateNotification />
    </div>
  );
}

export default App;



