import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { placesRouter } from './routes/places';
import { settingsRouter } from './routes/settings';
import { locationRouter } from './routes/location';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cors());  // Allow all origins in development

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/places', placesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/location', locationRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 