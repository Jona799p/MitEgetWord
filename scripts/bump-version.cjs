const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.error('[FEJL] Fandt ikke package.json!');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version || '1.0.0';

// Hent bump type fra argumenter: 'patch' (standard), 'minor', 'major' eller 'peek' (kun visning)
const arg = (process.argv[2] || 'patch').toLowerCase();

const parts = currentVersion.split('.').map(x => parseInt(x, 10) || 0);
while (parts.length < 3) parts.push(0);

let nextVersion = '';

if (arg === 'peek') {
  // Kun preview uden at ændre filen
  const patchParts = [...parts];
  patchParts[2] += 1;
  const minorParts = [...parts];
  minorParts[1] += 1;
  minorParts[2] = 0;
  console.log(JSON.stringify({
    current: currentVersion,
    nextPatch: patchParts.join('.'),
    nextMinor: minorParts.join('.')
  }));
  process.exit(0);
}

if (arg === 'major') {
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
} else if (arg === 'minor') {
  parts[1] += 1;
  parts[2] = 0;
} else {
  // patch (standard)
  parts[2] += 1;
}

nextVersion = parts.join('.');
pkg.version = nextVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log('========================================================');
console.log(`[VERSION] Automatisk opgraderet: v${currentVersion} -> v${nextVersion}`);
console.log('========================================================');
