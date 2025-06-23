import { PrismaClient } from '@prisma/client';
import { seedPlaces } from '../src/services/seedService';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check if home coordinates are set
    const homeCoordinates = await prisma.setting.findFirst({
      where: { key: 'home_coordinates' }
    });

    if (!homeCoordinates) {
      console.log('No home coordinates set. Places will be generated after setup is completed.');
      return;
    }

    await seedPlaces(); // Generate places for the set home location
    console.log('Database has been seeded with generated places');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 