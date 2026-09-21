const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist-electron');
const updatesDir = path.resolve(__dirname, '..', 'server', 'updates');
const pkgPath = path.resolve(__dirname, '..', 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version || '1.0.0';

if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

console.log('========================================================');
console.log(`      MITEGETWORD - PUBLICERING AF VERSION v${version}`);
console.log('========================================================\n');

try {
  const currentExeName = `MitEgetWord Setup ${version}.exe`;
  const currentBlockmapName = `${currentExeName}.blockmap`;

  // 1. Oprydning i dist-electron: Fjern forældede installationsfiler for at spare plads
  try {
    const distFiles = fs.readdirSync(distDir);
    let deletedOld = 0;
    for (const f of distFiles) {
      if ((f.endsWith('.exe') && f !== currentExeName && !f.includes('uninstaller')) ||
          (f.endsWith('.blockmap') && f !== currentBlockmapName)) {
        try {
          fs.unlinkSync(path.join(distDir, f));
          deletedOld++;
        } catch {}
      }
    }
    if (deletedOld > 0) {
      console.log(`[OPRYDNING] Fjernede ${deletedOld} forældede installationsfil(er) fra dist-electron.`);
    }
  } catch {}

  // 2. Kopiér til lokal server/updates
  const filesToCopy = [currentExeName, currentBlockmapName, 'latest.yml'];
  let copiedCount = 0;

  for (const fileName of filesToCopy) {
    const src = path.join(distDir, fileName);
    if (fs.existsSync(src)) {
      const dest = path.join(updatesDir, fileName);
      fs.copyFileSync(src, dest);
      console.log(` -> Lokal opdatering klar: ${fileName}`);
      copiedCount++;
    }
  }

  // 3. Kopiér til Server-PC netværksmapper (Tailscale eller netværksdrev)
  const remoteUpdatesDirs = [
    path.resolve('\\\\100.126.133.31\\Users\\jonas\\Desktop\\Server\\updates'),
    path.resolve('\\\\100.126.133.31\\Users\\jonas\\Desktop\\Server\\server\\updates'),
    path.resolve('Z:', 'Desktop', 'Server', 'updates'),
    path.resolve('Z:', 'Desktop', 'Server', 'server', 'updates')
  ];

  for (const rDir of remoteUpdatesDirs) {
    try {
      if (fs.existsSync(path.dirname(rDir))) {
        if (!fs.existsSync(rDir)) fs.mkdirSync(rDir, { recursive: true });

        for (const fileName of filesToCopy) {
          const src = path.join(distDir, fileName);
          if (fs.existsSync(src)) {
            const rDest = path.join(rDir, fileName);
            if (fs.existsSync(rDest) && fileName !== 'latest.yml') {
              if (fs.statSync(src).size === fs.statSync(rDest).size) continue;
            }
            fs.copyFileSync(src, rDest);
            console.log(` -> Kopieret til Server-PC: ${rDir}\\${fileName}`);
          }
        }

        // Oprydning på Server-PC: Behold kun de seneste 2 .exe versioner
        try {
          const remoteFiles = fs.readdirSync(rDir);
          const exeFiles = remoteFiles.filter(f => f.endsWith('.exe') && !f.includes('uninstaller'));
          if (exeFiles.length > 2) {
            const sorted = exeFiles.map(f => ({
              name: f,
              time: fs.statSync(path.join(rDir, f)).mtimeMs
            })).sort((a, b) => a.time - b.time);
            for (const item of sorted.slice(0, sorted.length - 2)) {
              try {
                fs.unlinkSync(path.join(rDir, item.name));
                const bmap = path.join(rDir, `${item.name}.blockmap`);
                if (fs.existsSync(bmap)) fs.unlinkSync(bmap);
                console.log(` -> Slettede gammel udgave fra server for at spare plads: ${item.name}`);
              } catch {}
            }
          }
        } catch {}
      }
    } catch {}
  }

  // 4. Kopiér den nyeste .exe til Skrivebordet
  const desktopPaths = [
    path.resolve(process.env.USERPROFILE || '', 'OneDrive', 'Skrivebord'),
    path.resolve(process.env.USERPROFILE || '', 'Desktop')
  ];

  for (const dPath of desktopPaths) {
    if (fs.existsSync(dPath)) {
      const src = path.join(distDir, currentExeName);
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, path.join(dPath, currentExeName));
          console.log(` -> Opdateret installationsfil på Skrivebord: ${currentExeName}`);
          break;
        } catch {}
      }
    }
  }

  // 5. Automatisk synkronisering af server-kode
  try {
    const deployScript = path.resolve(__dirname, 'deploy-server.cjs');
    if (fs.existsSync(deployScript)) {
      console.log('\nSynkroniserer server backend kode...');
      require('./deploy-server.cjs');
    }
  } catch {}

  console.log('\n========================================================');
  console.log(`[SUCCES] Version v${version} er klar!`);
  console.log('Klienter henter opdateringen automatisk.');
  console.log('========================================================\n');
} catch (err) {
  console.error('Fejl under publicering:', err.message);
  process.exit(1);
}

