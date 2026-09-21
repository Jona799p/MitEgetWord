const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Update Manager til MitEgetWord Server
 * Automatisk detektion af nye .exe installationsprogrammer,
 * generering af latest.yml med SHA-512 hashes og fejlfri servering til klient-pc'er.
 */

function parseExeVersion(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const match = filename.match(/(?:Setup\s*)?v?(\d+\.\d+\.\d+)/i) || filename.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function compareSemver(a, b) {
  if (!a || !b) return 0;
  const pa = a.split('.').map(x => parseInt(x, 10) || 0);
  const pb = b.split('.').map(x => parseInt(x, 10) || 0);
  while (pa.length < 3) pa.push(0);
  while (pb.length < 3) pb.push(0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function computeSha512(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha512').update(buf).digest('base64');
}

class UpdateManager {
  constructor(baseDir) {
    this.baseDir = baseDir || __dirname;
    this.updateDirs = this.resolveAllUpdateDirs();
    this.primaryDir = this.updateDirs[0] || path.resolve(this.baseDir, 'updates');
    this.latestInfo = null;
    this.watchers = [];
    this.debounceTimer = null;

    if (!fs.existsSync(this.primaryDir)) {
      try { fs.mkdirSync(this.primaryDir, { recursive: true }); } catch {}
    }

    this.refreshCatalog();
    this.startWatchers();
  }

  resolveAllUpdateDirs() {
    const candidates = [
      path.resolve(this.baseDir, 'updates'),
      path.resolve(this.baseDir, '..', 'updates'),
      path.resolve(this.baseDir, 'server', 'updates')
    ];

    const unique = [];
    for (const c of candidates) {
      const resolved = path.resolve(c);
      if (!unique.includes(resolved)) {
        unique.push(resolved);
      }
    }
    return unique;
  }

  startWatchers() {
    this.stopWatchers();

    for (const dir of this.updateDirs) {
      if (fs.existsSync(dir)) {
        try {
          const watcher = fs.watch(dir, (eventType, filename) => {
            if (filename && (filename.endsWith('.exe') || filename === 'latest.yml')) {
              if (this.debounceTimer) clearTimeout(this.debounceTimer);
              this.debounceTimer = setTimeout(() => {
                console.log(`[AutoUpdate Manager] Aendring detekteret i ${dir} (${filename})`);
                this.refreshCatalog();
              }, 1200);
            }
          });
          this.watchers.push(watcher);
        } catch (err) {
          console.warn(`[AutoUpdate Manager] Kunne ikke opsaette watcher paa ${dir}:`, err.message);
        }
      }
    }
  }

  stopWatchers() {
    for (const w of this.watchers) {
      try { w.close(); } catch {}
    }
    this.watchers = [];
  }

  refreshCatalog() {
    try {
      const allExes = [];

      for (const dir of this.updateDirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.exe') && !file.toLowerCase().includes('uninstall')) {
            const filePath = path.join(dir, file);
            try {
              const stat = fs.statSync(filePath);
              const version = parseExeVersion(file) || '1.0.0';
              allExes.push({
                filename: file,
                dir,
                fullPath: filePath,
                version,
                size: stat.size,
                mtime: stat.mtimeMs
              });
            } catch {}
          }
        }
      }

      if (allExes.length === 0) {
        this.latestInfo = null;
        return null;
      }

      allExes.sort((a, b) => {
        const semComp = compareSemver(b.version, a.version);
        if (semComp !== 0) return semComp;
        return b.mtime - a.mtime;
      });

      const latestExe = allExes[0];

      // Sikr at den nyeste .exe fil findes i alle eksisterende update-mapper
      for (const targetDir of this.updateDirs) {
        if (fs.existsSync(targetDir)) {
          const targetPath = path.join(targetDir, latestExe.filename);
          if (!fs.existsSync(targetPath) && fs.existsSync(latestExe.fullPath)) {
            try {
              fs.copyFileSync(latestExe.fullPath, targetPath);
              console.log(`[AutoUpdate Manager] Synkroniserede ${latestExe.filename} til ${targetDir}`);
            } catch {}
          }

          const blockmapSrc = `${latestExe.fullPath}.blockmap`;
          const blockmapDest = `${targetPath}.blockmap`;
          if (fs.existsSync(blockmapSrc) && !fs.existsSync(blockmapDest)) {
            try { fs.copyFileSync(blockmapSrc, blockmapDest); } catch {}
          }
        }
      }

      // Tjek om eksisterende latest.yml matcher den fundne nyeste .exe
      let needsYmlUpdate = true;
      const primaryYmlPath = path.join(this.primaryDir, 'latest.yml');

      if (fs.existsSync(primaryYmlPath)) {
        try {
          const ymlContent = fs.readFileSync(primaryYmlPath, 'utf-8');
          const versionMatch = ymlContent.match(/version:\s*([^\r\n]+)/i);
          const pathMatch = ymlContent.match(/path:\s*([^\r\n]+)/i);
          const sizeMatch = ymlContent.match(/size:\s*(\d+)/i);

          if (
            versionMatch && versionMatch[1].trim() === latestExe.version &&
            pathMatch && pathMatch[1].trim() === latestExe.filename &&
            sizeMatch && parseInt(sizeMatch[1], 10) === latestExe.size
          ) {
            needsYmlUpdate = false;
            this.latestInfo = {
              version: latestExe.version,
              filename: latestExe.filename,
              size: latestExe.size,
              fullPath: latestExe.fullPath,
              ymlContent
            };
          }
        } catch {}
      }

      if (needsYmlUpdate) {
        console.log(`[AutoUpdate Manager] Genererer nyt latest.yml for ${latestExe.filename} (v${latestExe.version})...`);
        const sha512 = computeSha512(latestExe.fullPath);
        const isoDate = new Date().toISOString();

        const ymlContent = 
`version: ${latestExe.version}
files:
  - url: ${latestExe.filename}
    sha512: ${sha512}
    size: ${latestExe.size}
path: ${latestExe.filename}
sha512: ${sha512}
releaseDate: '${isoDate}'
`;

        for (const dir of this.updateDirs) {
          if (fs.existsSync(dir)) {
            try {
              fs.writeFileSync(path.join(dir, 'latest.yml'), ymlContent, 'utf-8');
            } catch {}
          }
        }

        this.latestInfo = {
          version: latestExe.version,
          filename: latestExe.filename,
          size: latestExe.size,
          sha512,
          releaseDate: isoDate,
          fullPath: latestExe.fullPath,
          ymlContent
        };

        console.log(`[AutoUpdate Manager] [SUCCES] latest.yml er opdateret til v${latestExe.version}!`);
      }

      return this.latestInfo;
    } catch (err) {
      console.error('[AutoUpdate Manager] Fejl under katalog-opdatering:', err);
      return null;
    }
  }

  getLatestYmlContent() {
    const refreshed = this.refreshCatalog();
    if (refreshed && refreshed.ymlContent) {
      return refreshed.ymlContent;
    }
    const primaryYml = path.join(this.primaryDir, 'latest.yml');
    if (fs.existsSync(primaryYml)) {
      return fs.readFileSync(primaryYml, 'utf-8');
    }
    return null;
  }

  findFile(filename) {
    if (!filename) return null;
    for (const dir of this.updateDirs) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  setupExpressRoutes(app) {
    app.get('/updates/latest.yml', (req, res) => {
      try {
        const content = this.getLatestYmlContent();
        if (!content) {
          return res.status(404).send('Ingen opdateringer tilgaengelige endnu.');
        }
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(content);
      } catch (err) {
        res.status(500).send('Fejl ved hentning af latest.yml');
      }
    });

    app.get('/updates/:filename', (req, res, next) => {
      const filename = req.params.filename;
      const foundPath = this.findFile(filename);
      if (foundPath) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(foundPath);
      }
      next();
    });

    app.get('/api/updates/status', (req, res) => {
      const info = this.refreshCatalog();
      res.json({
        active: true,
        primaryDirectory: this.primaryDir,
        monitoredDirectories: this.updateDirs.filter(d => fs.existsSync(d)),
        latest: info ? {
          version: info.version,
          filename: info.filename,
          size: info.size,
          releaseDate: info.releaseDate
        } : null
      });
    });

    app.post('/api/updates/sync', (req, res) => {
      const info = this.refreshCatalog();
      res.json({ success: true, latest: info });
    });
  }
}

module.exports = UpdateManager;
