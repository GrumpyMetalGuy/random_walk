import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { seedPlaces } from '../services/seedService.js';
import { geocodeAddress } from '../services/geocoding.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Require authentication for all settings routes
router.use(authenticateToken);

const updateSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// Get all settings
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update setting
router.put('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = updateSettingSchema.parse(req.body);
    let { value } = updateSettingSchema.parse(req.body);
    
    // If updating home address, validate it first
    if (key === 'home_address') {
      // First geocode without country restriction to get the country
      const geoResult = await geocodeAddress(value);
      
      if (!geoResult) {
        return res.status(400).json({ error: 'Address not found' });
      }

      // Store the country code for future use
      await prisma.setting.upsert({
        where: { key: 'country_code' },
        update: { value: geoResult.country_code || '' },
        create: { key: 'country_code', value: geoResult.country_code || '' }
      });

      // Store coordinates separately for calculations (using first geocoding result)
      await prisma.setting.upsert({
        where: { key: 'home_coordinates' },
        update: { value: geoResult.lat + ',' + geoResult.lon },
        create: { key: 'home_coordinates', value: geoResult.lat + ',' + geoResult.lon }
      });

      // Keep the original human-readable address
      // value remains the original input address
    }
    
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Note: Removed automatic place seeding when home address is updated
    // Place generation is now handled separately via the setup wizard or admin interface

    res.json(setting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Failed to update setting:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
});

export const settingsRouter = router; 