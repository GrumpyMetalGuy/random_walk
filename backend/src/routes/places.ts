import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '../services/geocoding.js';
import { seedPlaces, addMorePlaces } from '../services/seedService.js';
import { fetchPlaces, enhancePlacesWithGeocode } from '../services/osmService.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import axios from 'axios';

const prisma = new PrismaClient();
const router = Router();

// Require authentication for all places routes
router.use(authenticateToken);

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
  lat: z.number(),
  lon: z.number(),
  distance: z.number().min(0.1).max(50),
  count: z.number().min(1).max(20).optional()
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
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    let places;
    const { exclude } = req.query;
    
    if (exclude) {
      // Only fetch places that have been interacted with (visited, planned, or ignored)
      const excludeStatuses = Array.isArray(exclude) ? exclude : [exclude];
      places = await prisma.place.findMany({
        where: {
          visitStatus: {
            in: ['VISITED', 'PLANNED', 'IGNORED']
          }
        }
      });
    } else {
      places = await prisma.place.findMany();
    }
    
    res.json(places || []);
  } catch (error) {
    console.error('Failed to fetch places:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// Get random places
router.post('/random', async (req: AuthenticatedRequest, res) => {
  try {
    const { lat, lon, distance, count = 5 } = randomPlacesSchema.parse(req.body);
    
    // Get all places that are available (not visited, planned, or ignored)
    const allPlaces = await prisma.place.findMany({
      where: {
        visitStatus: 'AVAILABLE'
      }
    });
    
    console.log(`Found ${allPlaces.length} available places in database`);
    
    if (allPlaces.length === 0) {
      return res.json([]);
    }

    // Calculate distances and filter by max distance
    const placesWithDistance = allPlaces
      .map(place => ({
        ...place,
        distance: calculateDistance(lat, lon, place.latitude, place.longitude)
      }))
      .filter(place => place.distance <= distance)
      // Randomize the order
      .sort(() => Math.random() - 0.5)
      // Take the requested number of places
      .slice(0, count);

    // Enhance places with reverse geocoding for better location context
    const enhancedPlaces = await enhancePlacesWithGeocode(placesWithDistance);
    
    console.log(`Returning ${enhancedPlaces.length} enhanced places`);
    res.json(enhancedPlaces);
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
router.post('/:id/plan', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { visitStatus: 'PLANNED' }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to update place:', error);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

// Mark place as visited
router.post('/:id/visit', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { 
        visitStatus: 'VISITED',
        lastVisited: new Date()
      }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to update place:', error);
    res.status(500).json({ error: 'Failed to update place' });
  }
});

// Ignore a place
router.post('/:id/ignore', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { 
        visitStatus: 'IGNORED',
        lastIgnored: new Date()
      }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to ignore place:', error);
    res.status(500).json({ error: 'Failed to ignore place' });
  }
});

// Unplan a place visit
router.post('/:id/unplan', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { visitStatus: 'AVAILABLE' }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to unplan place:', error);
    res.status(500).json({ error: 'Failed to unplan place' });
  }
});

// Unmark place as visited (make it available again)
router.post('/:id/unvisit', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { 
        visitStatus: 'AVAILABLE',
        lastVisited: null
      }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to unmark place as visited:', error);
    res.status(500).json({ error: 'Failed to unmark place as visited' });
  }
});

// Make an ignored place available again
router.post('/:id/unignore', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  
  try {
    const place = await prisma.place.findUnique({
      where: { id: parseInt(id) }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const updatedPlace = await prisma.place.update({
      where: { id: parseInt(id) },
      data: { 
        visitStatus: 'AVAILABLE',
        lastIgnored: null
      }
    });

    res.json(updatedPlace);
  } catch (error) {
    console.error('Failed to unignore place:', error);
    res.status(500).json({ error: 'Failed to unignore place' });
  }
});

// Generate new places
router.post('/generate', async (req: AuthenticatedRequest, res) => {
  try {
    const newPlacesCount = await addMorePlaces();
    res.json({ 
      message: `Added ${newPlacesCount} new places successfully`,
      newPlacesCount 
    });
  } catch (error) {
    console.error('Failed to generate places:', error);
    res.status(500).json({ error: 'Failed to generate places' });
  }
});

// Smart place discovery - generates new places from OSM and returns random selections
router.post('/discover', async (req: AuthenticatedRequest, res) => {
  try {
    const { distance, categories, count = 5, textFilter } = req.body;
    
    console.log(`Discovering ${count} places within ${distance} miles for categories:`, categories, textFilter ? `with text filter: "${textFilter}"` : '');
    
    // Get home address from settings
    const homeAddressSetting = await prisma.setting.findUnique({
      where: { key: 'home_address' }
    });
    
    if (!homeAddressSetting?.value) {
      return res.status(400).json({ error: 'Home address not configured' });
    }
    
    // Use geocoding service to get coordinates (with rate limiting and timeout)
    const geocodeResult = await geocodeAddress(homeAddressSetting.value);

    if (!geocodeResult) {
      return res.status(400).json({ error: 'Could not geocode home address' });
    }

    const lat = geocodeResult.lat;
    const lon = geocodeResult.lon;
    
    console.log(`Home coordinates: ${lat}, ${lon}`);
    
    // First, check if we have enough available places in the database
    const availablePlaces = await prisma.place.findMany({
      where: {
        visitStatus: 'AVAILABLE'
      }
    });
    
    // Calculate distances and filter by categories, distance, and text
    const filteredPlaces = availablePlaces
      .map(place => ({
        ...place,
        distance: calculateDistance(lat, lon, place.latitude, place.longitude)
      }))
      .filter(place => {
        // Filter by distance
        if (place.distance > distance) return false;
        
        // Filter by categories if specified
        if (categories && categories.length > 0) {
          if (!categories.includes(place.locationType)) return false;
        }
        
        // Filter by text if specified
        if (textFilter && textFilter.trim()) {
          const searchText = textFilter.toLowerCase().trim();
          const nameMatch = place.name.toLowerCase().includes(searchText);
          const descriptionMatch = place.description && 
            place.description.toLowerCase().includes(searchText);
          
          if (!nameMatch && !descriptionMatch) return false;
        }
        
        return true;
      });
    
    console.log(`Found ${filteredPlaces.length} existing places matching criteria`);
    
    // Always return available places without automatic OSM generation
    const randomPlaces = filteredPlaces
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, filteredPlaces.length));
    
    console.log(`Returning ${randomPlaces.length} existing places`);
    
    // Enhance with reverse geocoding for postcodes
    const enhancedPlaces = await enhancePlacesWithGeocode(randomPlaces);
    
    // Include metadata about whether more places should be generated
    const shouldGenerateMore = filteredPlaces.length < count;
    const response = {
      places: enhancedPlaces,
      meta: {
        found: filteredPlaces.length,
        requested: count,
        returned: enhancedPlaces.length,
        shouldGenerateMore
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Failed to discover places:', error);
    res.status(500).json({ error: 'Failed to discover places' });
  }
});

// Generate places with comprehensive search and progress tracking
router.post('/generate-comprehensive', async (req: AuthenticatedRequest, res) => {
  try {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial message
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      message: '🚀 Starting comprehensive place generation...' 
    })}\n\n`);

    // Progress callback function
    const progressCallback = (message: string) => {
      res.write(`data: ${JSON.stringify({ 
        type: 'progress', 
        message 
      })}\n\n`);
    };

    try {
      // Fetch places with progress updates
      const places = await fetchPlaces(progressCallback);
      
      progressCallback('💾 Saving places to database...');
      
      // Remove duplicates based on OSM ID
      const existingPlaces = await prisma.place.findMany({
        select: { osmId: true }
      });
      const existingOsmIds = new Set(existingPlaces.map(p => p.osmId));
      
      const newPlaces = places.filter(place => place.osmId && !existingOsmIds.has(place.osmId));
      
      if (newPlaces.length > 0) {
        await prisma.place.createMany({
          data: newPlaces
        });
      }

      // Send completion message
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        message: `✅ Generation complete! Added ${newPlaces.length} new places out of ${places.length} found.`,
        stats: {
          total: places.length,
          new: newPlaces.length,
          duplicates: places.length - newPlaces.length
        }
      })}\n\n`);
      
    } catch (error) {
      console.error('Error during place generation:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: `❌ Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Failed to start place generation:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to start place generation'
    });
  }
});

export { router as placesRouter }; 