import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { geocodeAddress } from '../services/geocoding';
import { seedPlaces } from '../services/seedService';

const prisma = new PrismaClient();
const router = express.Router();

// Validation schemas
const createPlaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  locationType: z.enum(['TOWN', 'CITY', 'TOURIST_ATTRACTION', 'PARK', 'PLAYGROUND']),
  latitude: z.number(),
  longitude: z.number(),
  what3words: z.string().optional(),
  osmId: z.string().optional(),
});

const randomPlacesSchema = z.object({
  distance: z.number().min(0),
  categories: z.array(z.enum(['TOWN', 'CITY', 'TOURIST_ATTRACTION', 'PARK', 'PLAYGROUND'])),
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// For testing purposes
export const setPrismaForTesting = (mockPrisma: PrismaClient) => {
  Object.assign(prisma, mockPrisma);
};

// Get all places
router.get('/', async (req, res) => {
  try {
    const places = await prisma.place.findMany();
    console.log('Found places:', places);
    res.json(places || []);
  } catch (error) {
    console.error('Failed to fetch places:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// Get random places
router.post('/random', async (req, res) => {
  try {
    const { distance, categories } = randomPlacesSchema.parse(req.body);
    
    // Get home location and country code from settings
    const [homeLocation, countryCode] = await Promise.all([
      prisma.setting.findFirst({
        where: { key: 'home_address' },
      }),
      prisma.setting.findFirst({
        where: { key: 'country_code' },
      })
    ]);

    if (!homeLocation) {
      return res.status(400).json({ error: 'Home location not set. Please set your home address in the Admin page.' });
    }

    // Parse stored coordinates
    const [lat, lon] = homeLocation.value.split(',').map(Number);
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Invalid home location format. Please reset your home address.' });
    }

    // Get all available places
    const allPlaces = await prisma.place.findMany({
      where: {
        locationType: {
          in: categories,
        },
      },
    });

    // Calculate distances and filter by max distance
    const placesWithDistance = allPlaces
      .map(place => ({
        ...place,
        distance: calculateDistance(lat, lon, place.latitude, place.longitude),
      }))
      .filter(place => place.distance <= distance)
      // Randomize the order
      .sort(() => Math.random() - 0.5)
      // Take up to 5 places
      .slice(0, 5);

    res.json(placesWithDistance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Failed to fetch random places:', error);
      res.status(500).json({ error: 'Failed to fetch random places' });
    }
  }
});

// Plan to visit a place
router.post('/:id/plan', async (req, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });
    console.log('Found place:', place);

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { isVisited: false }
    });
    console.log('Updated place:', updatedPlace);

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to update place:', error);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

// Mark place as visited
router.post('/:id/visit', async (req, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });
    console.log('Found place:', place);

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { 
        isVisited: true,
        lastVisited: new Date()
      }
    });
    console.log('Updated place:', updatedPlace);

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to update place:', error);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

// Generate new places
router.post('/generate', async (req, res) => {
  try {
    await seedPlaces();
    res.json({ message: 'Places generated successfully' });
  } catch (error) {
    console.error('Failed to generate places:', error);
    res.status(500).json({ error: 'Failed to generate places' });
  }
});

export { router as placesRouter }; 