import { prismaMock } from '../../test/setup';
import request from 'supertest';
import { app } from '../../app';
import { Place } from '@prisma/client';
import { setPrismaForTesting } from '../places';

describe('Places API', () => {
  beforeEach(() => {
    setPrismaForTesting(prismaMock);
  });

  const mockPlace: Place = {
    id: 1,
    name: 'Test Place',
    description: 'A test location',
    locationType: 'PARK',
    latitude: 51.0000,
    longitude: 0.0000,
    what3words: 'example.test.words',
    osmId: 'test123',
    isVisited: false,
    dateAdded: new Date(),
    lastVisited: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/places', () => {
    it('should return all places', async () => {
      prismaMock.place.findMany.mockResolvedValue([mockPlace]);

      const response = await request(app).get('/api/places');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Place');
    });
  });

  describe('POST /api/places/:id/plan', () => {
    it('should mark place as planned', async () => {
      const updatedPlace = { ...mockPlace, isVisited: false };
      prismaMock.place.findUnique.mockResolvedValue(mockPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/plan');
      
      expect(response.status).toBe(200);
      expect(response.body.isVisited).toBe(false);
    });

    it('should return 404 for non-existent place', async () => {
      prismaMock.place.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/places/999/plan');
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/places/:id/visit', () => {
    it('should mark place as visited', async () => {
      const updatedPlace = { ...mockPlace, isVisited: true, lastVisited: new Date() };
      prismaMock.place.findUnique.mockResolvedValue(mockPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/visit');
      
      expect(response.status).toBe(200);
      expect(response.body.isVisited).toBe(true);
      expect(response.body.lastVisited).toBeTruthy();
    });
  });
}); 