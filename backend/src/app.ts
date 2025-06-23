import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { placesRouter } from './routes/places.js';
import { settingsRouter } from './routes/settings.js';
import { locationRouter } from './routes/location.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import categoriesRouter from './routes/categories.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Serve static files from frontend build
const frontendDistPath = path.join(process.cwd(), 'public');
app.use(express.static(frontendDistPath));

// Health check endpoint (before catch-all route)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/places', placesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/location', locationRouter);

// Handle client-side routing - serve index.html for non-API routes
app.get('*', (req, res) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

export { app }; 