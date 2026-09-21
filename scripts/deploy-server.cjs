const fs = require('fs');
const path = require('path');

/**
 * MitEgetWord - Sikker og lynhurtig opdatering af Server PC
 * Synkroniserer udelukkende kode- og ruteændringer til \\100.126.133.31\\Users\\jonas\\Desktop\\Server.
 * BEMÆRK: Rører ALDRIG config.json, data/ (databaser) eller documents/ (Word-dokumenter)!
 */

const projectRoot = path.resolve(__dirname, '..');
const localServerDir = path.resolve(projectRoot, 'server');

// Mulige server-stier
const defaultTargets = [
  '\\\\100.126.133.31\\Users\\jonas\\Desktop\\Server',
  'Z:\\Desktop\\Server'
];

const customTarget = process.argv[2];
let targetDir = null;

if (customTarget && fs.existsSync(customTarget)) {
  targetDir = path.resolve(customTarget);
} else {
  for (const t of defaultTargets) {
    if (fs.existsSync(t)) {
      targetDir = t;
      break;
    }
  }
}

console.log('========================================================');
console.log('       MITEGETWORD - SERVER KODE SYNKRONISERING');
console.log('========================================================\n');

if (!targetDir) {
  console.error('[FEJL] Kunne ikke oprette forbindelse til Server-PC!');
  console.error('Tjek venligst:');
  console.error(' 1. Er Server-PC tændt?');
  console.error(' 2. Er Tailscale eller det lokale netværk forbundet?');
  console.error(` 3. Er netværksstien tilgængelig: ${defaultTargets[0]}`);
  console.log('========================================================\n');
  process.exit(1);
}

console.log(`[FORBUNDET] Fandt Server-PC på: ${targetDir}\n`);

// Beskyttede filer og mapper som ALDRIG må overskrives af deployment
const PROTECTED_NAMES = new Set([
  'config.json',
  'data',
  'documents',
  'node_modules',
  'updates'
]);

function copyFileSafe(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Tjek om filen allerede er identisk
  if (fs.existsSync(dest)) {
    const srcStat = fs.statSync(src);
    const dstStat = fs.statSync(dest);
    if (srcStat.size === dstStat.size && Math.abs(srcStat.mtimeMs - dstStat.mtimeMs) < 1000) {
      return false; // Ingen ændring nødvendig
    }
  }

  fs.copyFileSync(src, dest);
  return true;
}

function copyDirRecursive(srcDir, destDir) {
  let count = 0;
  if (!fs.existsSync(srcDir)) return count;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (PROTECTED_NAMES.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (copyFileSafe(srcPath, destPath)) {
        console.log(`  -> Opdateret: ${path.relative(targetDir, destPath)}`);
        count++;
      }
    }
  }
  return count;
}

let totalUpdated = 0;

// Bestem hvilke destinationsmapper der skal opdateres på serveren
const targetDirsToSync = [targetDir];
const subServerDir = path.join(targetDir, 'server');
if (fs.existsSync(subServerDir)) {
  targetDirsToSync.push(subServerDir);
}

for (const currentDest of targetDirsToSync) {
  const relName = path.relative(targetDir, currentDest) || 'rodmappe';
  console.log(`\nSynkroniserer server-kode til ${relName}...`);

  // 1. Kopiér server backend filer: index.cjs, updateManager.cjs
  const directFiles = ['index.cjs', 'updateManager.cjs', 'config.example.json'];
  for (const file of directFiles) {
    const src = path.join(localServerDir, file);
    if (fs.existsSync(src)) {
      const dest = path.join(currentDest, file);
      if (copyFileSafe(src, dest)) {
        console.log(`  -> Opdateret: ${path.relative(targetDir, dest)}`);
        totalUpdated++;
      }
    }
  }

  // 2. Kopiér apps mappen (AI, ImT, Word ruter)
  const localApps = path.join(localServerDir, 'apps');
  const destApps = path.join(currentDest, 'apps');
  totalUpdated += copyDirRecursive(localApps, destApps);

  // 3. Kopiér start-server.bat og konfigurer-server.bat hvis vi er i rodmappen
  if (currentDest === targetDir) {
    const helperFiles = ['start-server.bat', 'konfigurer-server.bat'];
    for (const hf of helperFiles) {
      const src = path.join(projectRoot, hf);
      if (fs.existsSync(src)) {
        const dest = path.join(currentDest, hf);
        if (copyFileSafe(src, dest)) {
          console.log(`  -> Opdateret: ${hf}`);
          totalUpdated++;
        }
      }
    }
  }
}

console.log('\n========================================================');
if (totalUpdated > 0) {
  console.log(`[SUCCES] ${totalUpdated} server-filer blev synkroniseret!`);
} else {
  console.log('[OK] Serveren var allerede fuldt opdateret med nyeste kode.');
}
console.log('Dine brugerdata, config.json og dokumenter er 100% bevaret.');
console.log('========================================================\n');
