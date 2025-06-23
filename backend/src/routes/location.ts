import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { nominatimRateLimiter } from '../services/nominatimRateLimiter.js';

const router = Router();
const prisma = new PrismaClient();

const searchSchema = z.object({
  query: z.string().min(1),
});

// Search locations via OpenStreetMap
router.get('/search', async (req, res) => {
  try {
    const { query } = searchSchema.parse(req.query);
    
    // Get country code from settings
    const countryCode = await prisma.setting.findFirst({
      where: { key: 'country_code' }
    });

    await nominatimRateLimiter.waitForNextRequest();

    const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('format', 'json');
    searchUrl.searchParams.append('limit', '5');
    searchUrl.searchParams.append('addressdetails', '1');
    
    if (countryCode?.value) {
      searchUrl.searchParams.append('countrycodes', countryCode.value.toLowerCase());
    }

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'RandomWalk/1.0',
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to search locations');
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Failed to search locations:', error);
      res.status(500).json({ error: 'Failed to search locations' });
    }
  }
});

// Validate location input
router.post('/validate', async (req, res) => {
  try {
    const { query } = searchSchema.parse(req.body);
    
    // Get country code from settings
    const countryCode = await prisma.setting.findFirst({
      where: { key: 'country_code' }
    });

    await nominatimRateLimiter.waitForNextRequest();

    const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('format', 'json');
    searchUrl.searchParams.append('limit', '1');
    searchUrl.searchParams.append('addressdetails', '1');
    
    if (countryCode?.value) {
      searchUrl.searchParams.append('countrycodes', countryCode.value.toLowerCase());
    }

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'RandomWalk/1.0',
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to validate location');
    }

    const [data] = await response.json();
    
    if (data) {
      res.json({
        valid: true,
        location: {
          name: data.display_name,
          latitude: parseFloat(data.lat),
          longitude: parseFloat(data.lon),
        },
      });
    } else {
      res.json({
        valid: false,
        error: 'Location not found',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Failed to validate location:', error);
      res.status(500).json({ error: 'Failed to validate location' });
    }
  }
});

// Convert What3Words to coordinates
router.get('/what3words/:words', async (req, res) => {
  // Note: This is a placeholder. You'll need to implement the actual What3Words API integration
  res.status(501).json({ error: 'What3Words integration not implemented' });
});

export const locationRouter = router; 