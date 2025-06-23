import { prismaMock } from '../../test/setup.js';
import request from 'supertest';
import { app } from '../../app.js';
import { Place } from '@prisma/client';
import { setPrismaForTesting } from '../places.js';
import { AuthService } from '../../services/auth.js';

describe('Places API', () => {
  let authToken: string;

  beforeEach(() => {
    setPrismaForTesting(prismaMock);
    
    // Create a test token for authentication
    const testUser = {
      userId: 1,
      username: 'testuser',
      role: 'USER'
    };
    authToken = AuthService.generateToken(testUser);
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
    visitStatus: 'AVAILABLE',
    dateAdded: new Date(),
    lastVisited: null,
    lastIgnored: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/places', () => {
    it('should return all places', async () => {
      prismaMock.place.findMany.mockResolvedValue([mockPlace]);

      const response = await request(app)
        .get('/api/places')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Place');
    });
  });

  describe('POST /api/places/:id/plan', () => {
    it('should mark place as planned', async () => {
      const updatedPlace = { ...mockPlace, visitStatus: 'PLANNED' as const };
      prismaMock.place.findUnique.mockResolvedValue(mockPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/plan')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.visitStatus).toBe('PLANNED');
    });

    it('should return 404 for non-existent place', async () => {
      prismaMock.place.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/places/999/plan')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/places/:id/visit', () => {
    it('should mark place as visited', async () => {
      const updatedPlace = { ...mockPlace, visitStatus: 'VISITED' as const, lastVisited: new Date() };
      prismaMock.place.findUnique.mockResolvedValue(mockPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/visit')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.visitStatus).toBe('VISITED');
      expect(response.body.lastVisited).toBeTruthy();
    });
  });

  describe('POST /api/places/:id/ignore', () => {
    it('should mark place as ignored with timestamp', async () => {
      const updatedPlace = { ...mockPlace, visitStatus: 'IGNORED' as const, lastIgnored: new Date() };
      prismaMock.place.findUnique.mockResolvedValue(mockPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/ignore')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.visitStatus).toBe('IGNORED');
      expect(response.body.lastIgnored).toBeTruthy();
    });
  });

  describe('POST /api/places/:id/unignore', () => {
    it('should unignore place and clear timestamp', async () => {
      const ignoredPlace = { ...mockPlace, visitStatus: 'IGNORED' as const, lastIgnored: new Date() };
      const updatedPlace = { ...mockPlace, visitStatus: 'AVAILABLE' as const, lastIgnored: null };
      prismaMock.place.findUnique.mockResolvedValue(ignoredPlace);
      prismaMock.place.update.mockResolvedValue(updatedPlace);

      const response = await request(app)
        .post('/api/places/1/unignore')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.visitStatus).toBe('AVAILABLE');
      expect(response.body.lastIgnored).toBe(null);
    });
  });
}); 