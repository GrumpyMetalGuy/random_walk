import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { seedPlaces } from '../services/seedService';
import { geocodeAddress } from '../services/geocoding';

const router = Router();
const prisma = new PrismaClient();

const updateSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update setting
router.put('/', async (req, res) => {
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

      // Now validate with the country code to ensure accuracy
      const validationResult = await geocodeAddress(value, geoResult.country_code);
      
      if (!validationResult) {
        return res.status(400).json({ error: 'Failed to validate address' });
      }

      // Use the full display name from OSM for consistency
      value = validationResult.lat + ',' + validationResult.lon;
    }
    
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // If home address was updated, reseed the places
    if (key === 'home_address') {
      await seedPlaces();
    }

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