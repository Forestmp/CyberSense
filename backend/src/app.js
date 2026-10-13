const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { query } = require('./db/pool');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/catalogos', require('./modules/scenarios/catalogs.routes'));
app.use('/api/scenarios', require('./modules/scenarios/scenarios.routes'));
app.use('/api/attempts', require('./modules/attempts/attempts.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
