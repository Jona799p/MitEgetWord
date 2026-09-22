const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const wordRoutes = require('./apps/word/routes.cjs');
const imtRoutes = require('./apps/imt/routes.cjs');
const aiRoutes = require('./apps/ai/routes.cjs');
const UpdateManager = require('./updateManager.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip-komprimering for lynhurtig dataoverførsel på netværket
try {
  const compression = require('compression');
  app.use(compression());
} catch {}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialiser automatisk Update Manager
const updateManager = new UpdateManager(__dirname);

// 1. Dokumenter og mapper
app.use('/api', wordRoutes);

// 2. ImT (Billede til tekst via serverens AI)
app.use('/api/imt', imtRoutes);

// 3. AI Assistent Hub (Viderestiller til Ollama, Gemini og Faster Whisper på server-pc)
app.use('/api/ai', (req, res, next) => {
  try {
    // Frigiv require cache så opdateringer af AI-ruter træder i kraft straks uden nedetid
    delete require.cache[require.resolve('./apps/ai/routes.cjs')];
    const currentAiRoutes = require('./apps/ai/routes.cjs');
    return currentAiRoutes(req, res, next);
  } catch (err) {
    return aiRoutes(req, res, next);
  }
});

// 4. Auto-Update Distribution: Servér altid opdateret latest.yml og installationsfiler
updateManager.setupExpressRoutes(app);
app.use('/updates', express.static(updateManager.primaryDir));

// 5. Admin / Vedligeholdelse
app.post('/api/admin/restart', (req, res) => {
  res.json({ success: true, message: 'Server genstarter...' });
  setTimeout(() => process.exit(0), 400);
});

// 6. Server Information Endpoint (viser IP og status til klienter)
app.get('/api/server-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }

  const latestUpdate = updateManager.refreshCatalog();

  res.json({
    name: 'MitEgetWord Server Hub',
    version: '1.0.0',
    status: 'online',
    port: PORT,
    localIps: ips,
    recommendedUrl: ips.length > 0 ? `http://${ips[0].address}:${PORT}` : `http://localhost:${PORT}`,
    updatesAvailable: !!latestUpdate,
    latestVersion: latestUpdate?.version || null,
    latestExe: latestUpdate?.filename || null
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`MitEgetWord Backend Server Hub kører på port ${PORT}`);
  console.log('Lytter på alle netværkskort (0.0.0.0)');
  
  const networkInterfaces = os.networkInterfaces();
  console.log('Tilgængelige server-adresser for dine klient-computere:');
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(` -> http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(` -> http://localhost:${PORT} (lokalt på denne pc)`);
  console.log('====================================================');
});

