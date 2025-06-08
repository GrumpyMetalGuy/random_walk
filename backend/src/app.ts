import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { placesRouter } from './routes/places';
import { settingsRouter } from './routes/settings';
import { locationRouter } from './routes/location';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true // Allow cookies to be sent
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/places', placesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/location', locationRouter);

export { app }; 