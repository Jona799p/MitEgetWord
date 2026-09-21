import React, { useState, useEffect, useRef } from 'react';
import { getServerUrl } from '../../store/documentStore';
import { Download, Sparkles, CheckCircle2, RotateCcw, X, ChevronRight } from 'lucide-react';
import './UpdateNotification.css';
import pkg from '../../../package.json';

// Sammenlign to semver versioner (f.eks. '1.0.7' > '1.0.6')
function isNewerVersion(remote, local) {
  if (!remote || !local) return false;
  const clean = v => (v || '').replace(/^[^\d]*/, '').trim();
  const rParts = clean(remote).split('.').map(x => parseInt(x, 10) || 0);
  const lParts = clean(local).split('.').map(x => parseInt(x, 10) || 0);
  while (rParts.length < 3) rParts.push(0);
  while (lParts.length < 3) lParts.push(0);

  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

const UpdateNotification = () => {
  const [currentVersion, setCurrentVersion] = useState(pkg.version || '1.0.0');
  const [newVersion, setNewVersion] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  const [progress, setProgress] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastCheckTimeRef = useRef(0);

  // Hent kørende Electron version
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('get-app-version').then(ver => {
          if (ver) setCurrentVersion(ver);
        }).catch(() => {});
      } catch {}
    }
  }, []);

  // Hent opdateringsstatus (prioriterer officielle GitHub Releases med lokal server som fallback)
  const checkForUpdatesDirect = async () => {
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 8000) return;
    lastCheckTimeRef.current = now;

    let remoteVer = null;
    let remoteFile = null;
    let directUrl = null;

    // 1. Tjek GitHub Releases (hurtigt og tilgængeligt overalt)
    try {
      const ghRes = await fetch('https://api.github.com/repos/Jona799p/MitEgetWord/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(3500)
      });
      if (ghRes.ok) {
        const release = await ghRes.json();
        const tagVer = (release.tag_name || release.name || '').replace(/^v/i, '').trim();
        if (tagVer) {
          remoteVer = tagVer;
          const exeAsset = release.assets?.find(a => a.name.endsWith('.exe') && !a.name.includes('uninstaller'));
          remoteFile = exeAsset ? exeAsset.name : `MitEgetWord Setup ${remoteVer}.exe`;
          directUrl = exeAsset ? exeAsset.browser_download_url : release.html_url;
        }
      }
    } catch {}

    // 2. Fallback til lokal server hvis GitHub ikke kunne nås
    if (!remoteVer) {
      try {
        const serverUrl = getServerUrl().replace(/\/+$/, '');
        const res = await fetch(`${serverUrl}/updates/latest.yml`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const text = await res.text();
          const versionMatch = text.match(/version:\s*([^\r\n]+)/i);
          const pathMatch = text.match(/path:\s*([^\r\n]+)/i);

          if (versionMatch && versionMatch[1]) {
            remoteVer = versionMatch[1].trim();
            remoteFile = pathMatch ? pathMatch[1].trim() : `MitEgetWord Setup ${remoteVer}.exe`;
            directUrl = `${serverUrl}/updates/${remoteFile}`;
          }
        }
      } catch {}
    }

    if (remoteVer && isNewerVersion(remoteVer, currentVersion)) {
      console.log(`[UpdateNotification] Ny version tilgængelig: v${remoteVer} (nuværende: v${currentVersion})`);
      setNewVersion(remoteVer);
      setDownloadFileName(remoteFile);
      setDownloadUrl(directUrl);
      
      if (status === 'idle' || status === 'error') {
        setStatus('available');
      }

      // I Electron: Anmod autoUpdater om at tjekke og hente
      if (typeof window !== 'undefined' && window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.invoke('check-for-updates');
        } catch {}
      }
    }
  };

  // Opsæt IPC listeners for Electron autoUpdater events
  useEffect(() => {
    let cleanup = () => {};

    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');

        const onChecking = () => {
          if (status !== 'downloading' && status !== 'downloaded') {
            setStatus('checking');
          }
        };

        const onAvailable = (_e, info) => {
          const ver = info?.version || '';
          if (ver) setNewVersion(ver);
          setStatus('downloading');
          setIsMinimized(false);
        };

        const onProgress = (_e, prog) => {
          setStatus('downloading');
          setProgress(Math.round(prog.percent || 0));
        };

        const onDownloaded = (_e, info) => {
          const ver = info?.version || '';
          if (ver) setNewVersion(ver);
          setStatus('downloaded');
          setProgress(100);
          setIsMinimized(false);
        };

        const onError = (_e, err) => {
          console.warn('[UpdateNotification] Electron updater fejl:', err);
          if (status !== 'downloaded') {
            setErrorMessage(typeof err === 'string' ? err : 'Kunne ikke hente automatisk');
          }
        };

        ipcRenderer.on('updater:checking', onChecking);
        ipcRenderer.on('updater:available', onAvailable);
        ipcRenderer.on('updater:progress', onProgress);
        ipcRenderer.on('updater:downloaded', onDownloaded);
        ipcRenderer.on('updater:error', onError);

        cleanup = () => {
          ipcRenderer.removeListener('updater:checking', onChecking);
          ipcRenderer.removeListener('updater:available', onAvailable);
          ipcRenderer.removeListener('updater:progress', onProgress);
          ipcRenderer.removeListener('updater:downloaded', onDownloaded);
          ipcRenderer.removeListener('updater:error', onError);
        };
      } catch {}
    }

    // Kør første tjek efter 2 sekunder
    const timer = setTimeout(checkForUpdatesDirect, 2000);
    // Periodisk tjek hvert 5. minut
    const interval = setInterval(checkForUpdatesDirect, 5 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      cleanup();
    };
  }, [currentVersion]);

  // Funktion til at installere og genstarte
  const handleRestartAndInstall = () => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('quit-and-install-update');
        return;
      } catch (err) {
        console.warn('Kunne ikke genstarte automatisk via IPC:', err);
      }
    }
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else if (downloadFileName) {
      const serverUrl = getServerUrl().replace(/\/+$/, '');
      window.open(`${serverUrl}/updates/${downloadFileName}`, '_blank');
    }
  };

  // Hvis der ikke er fundet nogen ny version, vises intet
  if (!newVersion || (!isNewerVersion(newVersion, currentVersion) && status !== 'downloaded')) {
    return null;
  }

  // Minimeret visning (lille diskret pille i hjørnet)
  if (isMinimized) {
    return (
      <div 
        className="update-pill-minimized"
        onClick={() => setIsMinimized(false)}
        title="Klik for at se opdateringsstatus"
      >
        <span className="update-pill-dot" />
        <span className="update-pill-text">
          {status === 'downloaded' ? `v${newVersion} klar til installation` : `Henter v${newVersion}...`}
        </span>
        <ChevronRight size={14} className="update-pill-arrow" />
      </div>
    );
  }

  return (
    <div className={`update-notification-card ${status}`}>
      <div className="update-card-header">
        <div className="update-card-title-group">
          {status === 'downloaded' ? (
            <CheckCircle2 size={18} className="update-icon success" />
          ) : (
            <Sparkles size={18} className="update-icon primary" />
          )}
          <span className="update-card-title">
            {status === 'downloaded' 
              ? `Opdatering v${newVersion} er klar!`
              : `Ny version v${newVersion} tilgængelig`}
          </span>
        </div>
        <button 
          className="update-close-btn" 
          onClick={() => setIsMinimized(true)}
          title="Minimer notifikation"
        >
          <X size={14} />
        </button>
      </div>

      <div className="update-card-body">
        {status === 'downloading' && (
          <>
            <p className="update-card-desc">
              Henter opdateringen i baggrunden fra Server Central... ({progress}%)
            </p>
            <div className="update-progress-bar-bg">
              <div 
                className="update-progress-bar-fill" 
                style={{ width: `${Math.max(5, progress)}%` }} 
              />
            </div>
          </>
        )}

        {status === 'downloaded' && (
          <p className="update-card-desc">
            Installationen er downloadet og klar. Genstart programmet for at tage den nye version i brug.
          </p>
        )}

        {(status === 'available' || status === 'idle' || status === 'checking') && (
          <p className="update-card-desc">
            En ny version er klar på Server Central (nuværende: v{currentVersion}).
          </p>
        )}

        {status === 'error' && (
          <p className="update-card-desc error">
            {errorMessage || 'Automatisk download fejlede.'} Du kan hente installationsfilen direkte nedenfor.
          </p>
        )}
      </div>

      <div className="update-card-actions">
        {status === 'downloaded' ? (
          <>
            <button 
              className="update-action-btn primary"
              onClick={handleRestartAndInstall}
            >
              <RotateCcw size={14} />
              <span>Genstart & Opdater nu</span>
            </button>
            <button 
              className="update-action-btn secondary"
              onClick={() => setIsMinimized(true)}
            >
              <span>Senere</span>
            </button>
          </>
        ) : (
          <>
            {typeof window !== 'undefined' && window.require && status !== 'downloading' ? (
              <button 
                className="update-action-btn primary"
                onClick={async () => {
                  setStatus('downloading');
                  setProgress(5);
                  try {
                    const { ipcRenderer } = window.require('electron');
                    const serverUrl = getServerUrl().replace(/\/+$/, '');
                    
                    // 1. Sørg for at autoUpdater altid peger på Server Central
                    await ipcRenderer.invoke('set-update-url', serverUrl);
                    
                    // 2. Forsøg direkte download af installationsfilen fra Server Central
                    const targetFile = downloadFileName || `MitEgetWord Setup ${newVersion}.exe`;
                    const directUrl = `${serverUrl}/updates/${targetFile}`;

                    try {
                      const res = await ipcRenderer.invoke('download-update-direct', {
                        url: directUrl,
                        fileName: targetFile,
                        version: newVersion
                      });
                      if (res && res.success) {
                        return;
                      }
                    } catch (dErr) {
                      console.warn('Direkte download fejlede, prøver autoUpdater.checkForUpdates:', dErr);
                    }

                    // Fallback til standard autoUpdater
                    ipcRenderer.invoke('check-for-updates');
                  } catch (err) {
                    console.error('Fejl ved opdateringskald:', err);
                  }
                }}
              >
                <Download size={14} />
                <span>Hent opdatering</span>
              </button>
            ) : null}

            {downloadFileName && (
              <button 
                onClick={() => {
                  const serverUrl = getServerUrl().replace(/\/+$/, '');
                  const fileUrl = `${serverUrl}/updates/${downloadFileName}`;
                  if (typeof window !== 'undefined' && window.require) {
                    try {
                      const { ipcRenderer } = window.require('electron');
                      ipcRenderer.invoke('open-external-url', fileUrl);
                      return;
                    } catch {}
                  }
                  window.open(fileUrl, '_blank');
                }}
                className="update-action-btn link"
                title="Download installationsfilen direkte i browseren"
              >
                <Download size={13} />
                <span>Download .exe ({newVersion})</span>
              </button>
            )}

            <button 
              className="update-action-btn secondary"
              onClick={() => setIsMinimized(true)}
            >
              <span>Skjul</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
