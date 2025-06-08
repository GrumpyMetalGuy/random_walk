import { Prisma } from '@prisma/client';

export async function fetchPlaces(): Promise<Prisma.PlaceCreateInput[]> {
  // This is a simplified version that returns test data
  return [
    {
      name: 'Test Park',
      description: 'A sample park for testing',
      locationType: 'PARK',
      latitude: 51.0000,
      longitude: 0.0000,
      osmId: 'test123',
      isVisited: false,
      dateAdded: new Date(),
      lastVisited: null,
    }
  ];
} 