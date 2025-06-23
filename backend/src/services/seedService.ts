import { PrismaClient } from '@prisma/client';
import { fetchPlaces } from './osmService.js';

const prisma = new PrismaClient();

export async function seedPlaces() {
  try {
    // Check if places already exist
    const existingCount = await prisma.place.count();
    
    if (existingCount > 0) {
      console.log(`Database already has ${existingCount} places, skipping seed`);
      return;
    }

    // Fetch and create new places
    const places = await fetchPlaces();
    
    for (const place of places) {
      try {
        await prisma.place.upsert({
          where: {
            osmId: place.osmId || `manual_${place.name}_${place.latitude}_${place.longitude}`
          },
          update: {
            // Update the place with fresh data if it exists
            name: place.name,
            description: place.description,
            locationType: place.locationType,
            latitude: place.latitude,
            longitude: place.longitude,
          },
          create: place
        });
      } catch (error) {
        // Skip places that can't be inserted (e.g., duplicates)
        console.log(`Skipping place "${place.name}" due to error:`, error);
      }
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function addMorePlaces() {
  try {
    console.log('Adding more places to existing collection...');
    
    // Get existing places to avoid duplicates
    const existingPlaces = await prisma.place.findMany({
      select: { osmId: true, name: true, latitude: true, longitude: true }
    });
    
    // Create multiple sets for different types of duplicate detection
    const existingOsmIds = new Set(existingPlaces.map(p => p.osmId).filter(Boolean));
    const existingCoordinates = new Set(existingPlaces.map(p => `${p.latitude},${p.longitude}`));
    const existingNames = new Set(existingPlaces.map(p => p.name.toLowerCase()));
    
    // Fetch new places
    const places = await fetchPlaces();
    
    // Filter out places that already exist using multiple criteria
    const newPlaces = places.filter(place => {
      // Skip if osmId already exists
      if (place.osmId && existingOsmIds.has(place.osmId)) {
        return false;
      }
      
      // Skip if same coordinates already exist
      const coords = `${place.latitude},${place.longitude}`;
      if (existingCoordinates.has(coords)) {
        return false;
      }
      
      // Skip if same name already exists (case insensitive)
      if (existingNames.has(place.name.toLowerCase())) {
        return false;
      }
      
      return true;
    });
    
    console.log(`Found ${places.length} total places, ${newPlaces.length} are new`);
    
    let addedCount = 0;
    
    // Add only new places with error handling for each
    for (const place of newPlaces) {
      try {
        // Use upsert to handle any remaining edge case duplicates
        await prisma.place.upsert({
          where: {
            osmId: place.osmId || `manual_${place.name}_${place.latitude}_${place.longitude}`
          },
          update: {
            // Update the place with fresh data if it exists
            name: place.name,
            description: place.description,
            locationType: place.locationType,
            latitude: place.latitude,
            longitude: place.longitude,
          },
          create: place
        });
        addedCount++;
      } catch (error) {
        console.log(`Failed to add place "${place.name}":`, error);
        // Continue with next place
      }
    }

    console.log(`Successfully added ${addedCount} new places to database`);
    return addedCount;
  } catch (error) {
    console.error('Error adding more places:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
} 