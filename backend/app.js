import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from '../shared/routes.js';

// The initial version is single-user. Add authentication before exposing it publicly.
export function createApp(
  db,
  { frontendUrl = 'http://localhost:5173', serveFrontend = true } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: frontendUrl }));
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    if (
      ['POST', 'PUT'].includes(req.method) &&
      (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    ) {
      return res.status(400).json({ error: 'Send a JSON object with the required fields.' });
    }
    next();
  });
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  registerRoutes(app, db);
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  const dist = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
  if (serveFrontend && existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(`${dist}/index.html`));
  }
  app.use((error, req, res, next) => {
    if (error.code === '23505')
      return res
        .status(409)
        .json({ error: 'This category or monthly category budget already exists.' });
    if (error.code === '23503')
      return res
        .status(400)
        .json({ error: 'Choose an existing category with the correct transaction type.' });
    const status =
      error.status || (['23514', '22003', '22007', '22008'].includes(error.code) ? 400 : 500);
    if (status >= 500) console.error(error.message);
    res.status(status).json({
      error:
        status >= 500
          ? 'Unable to complete request. Check the database connection and setup.'
          : error.message,
    });
  });
  return app;
}
