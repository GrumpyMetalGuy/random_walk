import { PrismaClient } from '@prisma/client';
import { fetchPlaces } from './osmService';

const prisma = new PrismaClient();

export async function seedPlaces() {
  try {
    // Clear existing data
    await prisma.place.deleteMany();

    // Fetch and create new places
    const places = await fetchPlaces();
    
    for (const place of places) {
      await prisma.place.create({
        data: place
      });
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
} 