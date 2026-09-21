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

console.log(`\nUdgiver opdatering v${version} til server/updates...`);

try {
  const files = fs.readdirSync(distDir);
  let copiedCount = 0;
  let exeFile = null;

  for (const file of files) {
    if (file === 'latest.yml' || file.endsWith('.exe') || file.endsWith('.blockmap')) {
      const src = path.join(distDir, file);
      const dest = path.join(updatesDir, file);
      fs.copyFileSync(src, dest);
      console.log(` -> Opdatering klar: ${file}`);
      copiedCount++;

      // Kopiér også til server netværksmapper (både direkte IP UNC-sti og eventuelt Z: netværksdrev)
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
            const rDest = path.join(rDir, file);
            // Undgå at gensende uændrede filer over netværket
            if (fs.existsSync(rDest) && file !== 'latest.yml') {
              const srcStat = fs.statSync(src);
              const dstStat = fs.statSync(rDest);
              if (srcStat.size === dstStat.size) {
                continue;
              }
            }
            fs.copyFileSync(src, rDest);
            console.log(` -> Opdatering kopieret til: ${rDir}\\${file}`);
          }
        } catch (rErr) {
          // Ignorer hvis netværkssti ikke er tilgængelig
        }
      }

      if (file.endsWith('.exe') && !file.includes('uninstaller')) {
        exeFile = file;
      }
    }
  }

  // Kopiér også den nye .exe til Skrivebordet
  if (exeFile) {
    const desktopPaths = [
      path.resolve(process.env.USERPROFILE || '', 'OneDrive', 'Skrivebord'),
      path.resolve(process.env.USERPROFILE || '', 'Desktop')
    ];

    for (const dPath of desktopPaths) {
      if (fs.existsSync(dPath)) {
        const dest = path.join(dPath, exeFile);
        try {
          fs.copyFileSync(path.join(distDir, exeFile), dest);
          console.log(` -> Opdateret installationsfil på Skrivebord: ${exeFile}`);
          break;
        } catch {}
      }
    }
  }

  if (copiedCount > 0) {
    console.log(`\n========================================================`);
    console.log(`[SUCCES] Version v${version} er udgivet og klar!`);
    console.log(`Klient-computere vil automatisk modtage opdateringen.`);
    console.log(`========================================================\n`);
  } else {
    console.warn('\nAdvarsel: Ingen opdateringsfiler fundet i dist-electron!');
  }
} catch (err) {
  console.error('Fejl under kopiering af opdateringsfiler:', err.message);
  process.exit(1);
}
