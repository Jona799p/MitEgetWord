const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version || '1.0.0';
const tagName = `v${version}`;

console.log('========================================================');
console.log(`       GITHUB RELEASE: PUSHER VERSION ${tagName}`);
console.log('========================================================\n');

function run(cmd, desc) {
  try {
    console.log(`[GIT] ${desc || cmd}...`);
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    return true;
  } catch (err) {
    console.error(`[GIT FEJL] Kommando fejlede: ${cmd}`);
    return false;
  }
}

// 1. Git add
if (!run('git add .', 'Tilføjer filer til staging')) {
  process.exit(1);
}

// 2. Git commit (kun hvis der er ændringer)
try {
  const status = execSync('git status --porcelain', { cwd: path.resolve(__dirname, '..') }).toString().trim();
  if (status.length > 0) {
    run(`git commit -m "Release ${tagName}"`, `Opretter commit for ${tagName}`);
  } else {
    console.log('[GIT] Ingen nye kodeændringer at committe.');
  }
} catch (e) {}

// 3. Git tag (hvis tag ikke allerede findes)
try {
  const existingTags = execSync('git tag', { cwd: path.resolve(__dirname, '..') }).toString();
  if (existingTags.split('\n').map(t => t.trim()).includes(tagName)) {
    console.log(`[GIT] Tag ${tagName} findes allerede.`);
  } else {
    run(`git tag -a ${tagName} -m "Udgivelse ${tagName}"`, `Opretter tag ${tagName}`);
  }
} catch (e) {
  run(`git tag -a ${tagName} -m "Udgivelse ${tagName}"`, `Opretter tag ${tagName}`);
}

// 4. Git push
console.log('\n[GIT] Pusher commit og tags til GitHub...');
const pushed = run(`git push origin main --tags`, 'Pusher til GitHub');

if (pushed) {
  console.log('\n========================================================');
  console.log(`[SUCCES] Koden og tagget ${tagName} er pushet til GitHub!`);
  console.log('GitHub Actions vil nu automatisk bygge installationsfilen');
  console.log('og oprette din GitHub Release i skyen.');
  console.log(`Følg bygningen her: https://github.com/Jona799p/MitEgetWord/actions`);
  console.log('========================================================\n');
} else {
  console.log('\n[INFO] Kunne ikke auto-pushe til GitHub (kræver måske login/token).');
  console.log('Du kan selv køre:');
  console.log(`  git push origin main --tags\n`);
}
