const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { createDocxBuffer, sanitizeFilename } = require('./docxGenerator.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Auto-updater konfiguration: GitHub Releases som standard
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdaterFeed() {
  try {
    const configPath = path.join(app.getPath('userData'), 'server-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cfg.useServerUpdates && cfg.serverUrl && typeof cfg.serverUrl === 'string') {
        const customUrl = `${cfg.serverUrl.trim().replace(/\/+$/, '')}/updates`;
        autoUpdater.setFeedURL({
          provider: 'generic',
          url: customUrl
        });
        console.log(`[AutoUpdater] Bruger konfigureret lokal server feed: ${customUrl}`);
        return;
      }
    }
  } catch (err) {
    console.warn('[AutoUpdater] Kunne ikke indlæse server-config:', err.message);
  }

  // Standard: Officielle opdateringer via GitHub Releases (kræver ingen server eller tailscale)
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Jona799p',
      repo: 'MitEgetWord'
    });
    console.log('[AutoUpdater] Konfigureret til GitHub Releases (Jona799p/MitEgetWord)');
  } catch (err) {
    console.warn('[AutoUpdater] Fejl ved opsætning af GitHub feed:', err.message);
  }
}

setupAutoUpdaterFeed();

function getDocumentsDir() {
  let dir = '';
  try {
    // Sikker lokal mappe isoleret pr. pc uden for OneDrive
    const userData = app.getPath('userData');
    dir = path.join(userData, 'documents');
  } catch {
    const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
    dir = path.join(localAppData, 'MitEgetWord', 'documents');
  }

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Engangsmigrering fra den gamle OneDrive-mappe (kører KUN én gang hvis flag ikke er sat)
    const migrationMarker = path.join(dir, '.migration_done');
    if (!fs.existsSync(migrationMarker)) {
      try {
        let oldBaseDir = '';
        try {
          oldBaseDir = app.getPath('documents');
        } catch {
          oldBaseDir = path.join(require('os').homedir(), 'Documents');
        }
        const oldDir = path.join(oldBaseDir, 'MitEgetWord');
        if (fs.existsSync(oldDir) && path.resolve(oldDir) !== path.resolve(dir)) {
          const oldFiles = fs.readdirSync(oldDir);
          for (const f of oldFiles) {
            if (f.toLowerCase().endsWith('.docx')) {
              const oldTarget = path.join(oldDir, f);
              const newTarget = path.join(dir, f);
              if (!fs.existsSync(newTarget)) {
                try {
                  fs.copyFileSync(oldTarget, newTarget);
                  console.log(`[Migration] Engangskopierede "${f}" til lokal pc-mappe`);
                } catch {}
              }
            }
          }
        }
      } catch (migErr) {
        console.warn('Fejl ved engangsmigrering:', migErr.message);
      } finally {
        try { fs.writeFileSync(migrationMarker, new Date().toISOString(), 'utf-8'); } catch {}
      }
    }
  } catch (err) {
    console.warn('Kunne ikke sikre dokumentmappen:', err.message);
  }
  return dir;
}

function cleanupOldHtmlFiles() {
  try {
    const dir = getDocumentsDir();
    if (fs.existsSync(dir)) {
      const existingFiles = fs.readdirSync(dir);
      for (const f of existingFiles) {
        if (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) {
          try { fs.unlinkSync(path.join(dir, f)); } catch {}
        }
      }
    }
  } catch {}
}

// ----------------------------------------------------
// Lokale Filer IPC Handlers
// ----------------------------------------------------

ipcMain.handle('get-documents-dir', () => {
  return getDocumentsDir();
});

ipcMain.handle('save-local-document', async (event, { id, title, content, oldTitle }) => {
  try {
    const docDir = getDocumentsDir();
    const cleanTitle = sanitizeFilename(title || 'Dokument');
    const docxPath = path.join(docDir, `${cleanTitle}.docx`);

    // Hvis titlen er omdøbt, fjern filen med den gamle titel
    if (oldTitle) {
      const oldClean = sanitizeFilename(oldTitle);
      if (oldClean !== cleanTitle) {
        const oldPath = path.join(docDir, `${oldClean}.docx`);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
    }

    // Fjern eventuel gammel .html fil med samme navn
    const htmlPath = path.join(docDir, `${cleanTitle}.html`);
    if (fs.existsSync(htmlPath)) {
      try { fs.unlinkSync(htmlPath); } catch {}
    }

    // Generer .docx buffer og skriv fysisk til disken på denne pc
    const buffer = await createDocxBuffer(title || 'Dokument', content || '<p></p>');
    fs.writeFileSync(docxPath, buffer);
    console.log(`[LocalDocs] Dokument gemt lokalt paa disk: ${docxPath} (${buffer.length} bytes)`);

    return { success: true, filePath: docxPath, folder: docDir, title: cleanTitle };
  } catch (err) {
    console.error('IPC save-local-document fejl:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-local-document', async (event, { title, filePath }) => {
  try {
    const docDir = getDocumentsDir();
    const cleanTitle = sanitizeFilename(title || 'Dokument');
    const docxPath = path.join(docDir, `${cleanTitle}.docx`);
    const htmlPath = path.join(docDir, `${cleanTitle}.html`);
    let deleted = false;

    // Hvis direkte filsti er givet
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); deleted = true; } catch {}
    }

    if (fs.existsSync(docxPath)) {
      try { fs.unlinkSync(docxPath); deleted = true; } catch {}
    }
    if (fs.existsSync(htmlPath)) {
      try { fs.unlinkSync(htmlPath); deleted = true; } catch {}
    }

    const normalizeStr = s => (s || '').normalize('NFC').toLowerCase().replace(/[\s\-_]+/g, '').trim();
    const targetNorm = normalizeStr(cleanTitle);

    // Tjek også alle filer i mappen (case-insensitive, unicode-normaliseret)
    if (fs.existsSync(docDir)) {
      const files = fs.readdirSync(docDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (ext === '.docx' || ext === '.html' || ext === '.htm') {
          const base = path.basename(f, ext);
          if (normalizeStr(base) === targetNorm || base.toLowerCase().trim() === cleanTitle.toLowerCase().trim()) {
            try { fs.unlinkSync(path.join(docDir, f)); deleted = true; } catch {}
          }
        }
      }
    }

    // Rens også fra gammel OneDrive-mappe hvis filen stadig ligger der
    try {
      let oldBaseDir = '';
      try { oldBaseDir = app.getPath('documents'); } catch { oldBaseDir = path.join(require('os').homedir(), 'Documents'); }
      const oldDir = path.join(oldBaseDir, 'MitEgetWord');
      if (fs.existsSync(oldDir)) {
        const oldFiles = fs.readdirSync(oldDir);
        for (const f of oldFiles) {
          const ext = path.extname(f).toLowerCase();
          const base = path.basename(f, ext);
          if (normalizeStr(base) === targetNorm || base.toLowerCase().trim() === cleanTitle.toLowerCase().trim()) {
            try { fs.unlinkSync(path.join(oldDir, f)); } catch {}
          }
        }
      }
    } catch {}

    // Rens også fra dev mode /documents hvis den findes der så den ikke re-importeres
    try {
      const devDocs = path.resolve(__dirname, '..', 'documents');
      if (fs.existsSync(devDocs)) {
        const devFiles = fs.readdirSync(devDocs);
        for (const f of devFiles) {
          const ext = path.extname(f).toLowerCase();
          const base = path.basename(f, ext);
          if (normalizeStr(base) === targetNorm || base.toLowerCase().trim() === cleanTitle.toLowerCase().trim()) {
            try { fs.unlinkSync(path.join(devDocs, f)); } catch {}
          }
        }
      }
    } catch {}

    console.log(`[LocalDocs] Dokument slettet lokalt fra disk: ${cleanTitle} (slettet: ${deleted})`);
    return { success: true, deleted, path: docxPath };
  } catch (err) {
    console.error('IPC delete-local-document fejl:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-local-files', async () => {
  try {
    const docDir = getDocumentsDir();
    if (!fs.existsSync(docDir)) {
      return { success: true, folder: docDir, files: [] };
    }
    const entries = fs.readdirSync(docDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.docx' || ext === '.doc' || ext === '.txt' || ext === '.md' || ext === '.mew' || ext === '.json') {
          const fullPath = path.join(docDir, entry.name);
          try {
            const stats = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              baseName: path.basename(entry.name, ext),
              path: fullPath,
              ext,
              size: stats.size,
              updatedAt: stats.mtime.toISOString(),
              createdAt: stats.birthtime.toISOString()
            });
          } catch {}
        }
      }
    }
    return { success: true, folder: docDir, files };
  } catch (err) {
    return { success: false, error: err.message, files: [] };
  }
});

ipcMain.handle('read-local-file', async (event, targetPath) => {
  try {
    if (targetPath && fs.existsSync(targetPath)) {
      const buffer = fs.readFileSync(targetPath);
      return { success: true, data: buffer };
    }
    return { success: false, error: 'Fil ikke fundet' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-item-in-explorer', async (event, targetPath) => {
  try {
    const docDir = getDocumentsDir();
    const cleanPath = targetPath ? path.resolve(targetPath) : docDir;

    if (fs.existsSync(cleanPath)) {
      const stats = fs.statSync(cleanPath);
      if (stats.isDirectory()) {
        await shell.openPath(cleanPath);
      } else {
        // Markér filen i Stifinder/File Explorer
        shell.showItemInFolder(cleanPath);
      }
      return { success: true, path: cleanPath };
    } else {
      // Hvis filen ikke findes på den præcise sti, åbn dokumentmappen i stedet
      await shell.openPath(docDir);
      return { success: true, path: docDir };
    }
  } catch (err) {
    console.error('IPC open-item-in-explorer fejl:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-documents-folder', async () => {
  try {
    const docDir = getDocumentsDir();
    await shell.openPath(docDir);
    return { success: true, folder: docDir };
  } catch (err) {
    console.error('IPC open-documents-folder fejl:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-file-in-system', async (event, targetPath) => {
  try {
    if (targetPath && fs.existsSync(targetPath)) {
      const errMsg = await shell.openPath(targetPath);
      if (errMsg) {
        return { success: false, error: errMsg };
      }
      return { success: true, path: targetPath };
    }
    return { success: false, error: 'Filen eksisterer ikke på computeren' };
  } catch (err) {
    console.error('IPC open-file-in-system fejl:', err);
    return { success: false, error: err.message };
  }
});

// Auto-update IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('set-update-url', (event, serverUrl) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'server-config.json');
    if (serverUrl && typeof serverUrl === 'string' && serverUrl.trim() !== '') {
      const trimmed = serverUrl.trim().replace(/\/+$/, '');
      const feedUrl = `${trimmed}/updates`;
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: feedUrl
      });
      console.log(`[AutoUpdater] Feed URL opdateret til lokal server: ${feedUrl}`);

      try {
        fs.writeFileSync(configPath, JSON.stringify({ serverUrl: trimmed, useServerUpdates: true }), 'utf-8');
      } catch {}

      if (!isDev) {
        setTimeout(() => {
          console.log('[AutoUpdater] Kører opdateringstjek for ny server feed URL...');
          autoUpdater.checkForUpdates().catch(err => {
            console.warn('[AutoUpdater] Tjek efter URL-skift fejlede:', err.message);
          });
        }, 800);
      }

      return { success: true, url: feedUrl };
    } else {
      // Nulstil til officiel GitHub Releases feed
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'Jona799p',
        repo: 'MitEgetWord'
      });
      console.log(`[AutoUpdater] Feed URL nulstillet til GitHub Releases (Jona799p/MitEgetWord)`);

      try {
        fs.writeFileSync(configPath, JSON.stringify({ serverUrl: '', useServerUpdates: false }), 'utf-8');
      } catch {}

      return { success: true, url: 'github:Jona799p/MitEgetWord' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { status: 'dev', message: 'Opdateringer er deaktiveret i udviklingstilstand.' };
  }
  try {
    console.log('[AutoUpdater] checkForUpdates kaldt via IPC...');
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking', result };
  } catch (err) {
    console.warn('[AutoUpdater] checkForUpdates fejl:', err.message);
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('quit-and-install-update', () => {
  console.log('[AutoUpdater] quitAndInstall eksekveres...');
  autoUpdater.quitAndInstall(false, true);
});

// Videresend auto-update events til frontend renderer med logning
autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Søger efter opdateringer...');
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:checking'));
});

autoUpdater.on('update-available', (info) => {
  console.log(`[AutoUpdater] Ny version v${info?.version} fundet! Påbegynder download.`);
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:available', info));
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] Ingen opdateringer fundet (programmet er opdateret).');
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:not-available', info));
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[AutoUpdater] Henter: ${Math.round(progress.percent)}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`);
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:progress', progress));
});

autoUpdater.on('update-downloaded', (info) => {
  console.log(`[AutoUpdater] Opdatering v${info?.version} er downloadet og klar til installation!`);
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:downloaded', info));
});

autoUpdater.on('error', (err) => {
  console.warn('[AutoUpdater] Fejl under opdatering:', err ? err.message : 'Ukendt fejl');
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('updater:error', err ? err.message : 'Ukendt fejl'));
});

function checkDevServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: '#050505',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMenuBarVisibility(false);

  // Handle mouse side buttons (Back / Forward) and Windows app commands
  win.on('app-command', (event, cmd) => {
    if (cmd === 'browser-backward') {
      event.preventDefault();
      win.webContents.send('app-navigate-back');
    } else if (cmd === 'browser-forward') {
      event.preventDefault();
      win.webContents.send('app-navigate-forward');
    }
  });

  // Shortcut to toggle DevTools (F12 or Ctrl+Shift+I) and reload (Ctrl+R or F5)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      win.webContents.reload();
      event.preventDefault();
    }
  });

  const distFile = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    let activeDevUrl = null;
    if (await checkDevServer('http://127.0.0.1:5173')) {
      activeDevUrl = 'http://127.0.0.1:5173';
    } else if (await checkDevServer('http://localhost:5173')) {
      activeDevUrl = 'http://localhost:5173';
    }

    if (activeDevUrl) {
      win.loadURL(activeDevUrl);
    } else {
      win.loadFile(distFile);
    }
  } else {
    win.loadFile(distFile);
  }

  let isFallingBack = false;
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignorer ERR_ABORTED (-3) og del-elementer der ikke er hovedrammen
    if (errorCode === -3 || !isMainFrame) return;

    if (!isFallingBack && !validatedURL?.includes('dist')) {
      isFallingBack = true;
      console.warn(`Fejl ved indlaesning af ${validatedURL} (kode ${errorCode}: ${errorDescription}), forsoeger dist/index.html`);
      win.loadFile(distFile).catch(err => {
        console.error('Kunne heller ikke indlaese dist/index.html:', err);
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  cleanupOldHtmlFiles();

  // Tjek automatisk for opdateringer i baggrunden når appen starter i produktionsmiljø
  if (!isDev) {
    setTimeout(() => {
      console.log('[AutoUpdater] Opstartstjek for opdateringer igangsættes...');
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[AutoUpdater] Baggrundsopdateringstjek fejlede (måske offline):', err.message);
      });
    }, 1200);

    // Periodisk tjek hvert 15. minut
    setInterval(() => {
      console.log('[AutoUpdater] Periodisk tjek for opdateringer igangsættes...');
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[AutoUpdater] Periodisk tjek fejlede:', err.message);
      });
    }, 15 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
