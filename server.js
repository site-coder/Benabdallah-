import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const BLOCKED_FILES = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/tsconfig.json',
  '/metadata.json',
  '/.env',
  '/.env.local',
  '/.env.example',
]);

app.use((req, res, next) => {
  if (BLOCKED_FILES.has(req.path)) {
    return res.status(404).end();
  }
  next();
});

app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.use(
  express.static(__dirname, {
    dotfiles: 'ignore',
    index: ['index.html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
    },
  })
);

app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  res.status(404).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
