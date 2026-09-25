require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupSwagger } = require('./src/swagger');
const documentsRouter = require('./src/routes/documents');
const chatRouter = require('./src/routes/chat');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup OpenAPI / Swagger UI documentation at /api-docs and /api-docs.json
setupSwagger(app);

// API Routes
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA / client routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error'
  });
});

// Start listening if not running in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`DocChat server running on http://localhost:${PORT}`);
    console.log(`Interactive API documentation at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
