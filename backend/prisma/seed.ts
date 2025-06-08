import { PrismaClient } from '@prisma/client';
import { seedPlaces } from '../src/services/seedService';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check if home location is set
    const homeLocation = await prisma.setting.findFirst({
      where: { key: 'home_address' }
    });

    if (!homeLocation) {
      console.log('No home location set. Places will be generated after setup is completed.');
      return;
    }

    await seedPlaces(false); // false means clear existing places before seeding
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