import { prismaMock } from '../../test/setup';
import request from 'supertest';
import { app } from '../../app';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Location API', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET /api/location/search', () => {
    it('should include country code in search when available', async () => {
      // Mock the country code setting
      prismaMock.setting.findFirst.mockResolvedValue({
        key: 'country_code',
        value: 'fr',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock the fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ display_name: 'Test Location' }]),
      });

      const response = await request(app)
        .get('/api/location/search')
        .query({ query: 'test location' });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('countrycodes=fr'),
        expect.any(Object)
      );
    });

    it('should work without country code', async () => {
      // Mock no country code setting
      prismaMock.setting.findFirst.mockResolvedValue(null);

      // Mock the fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ display_name: 'Test Location' }]),
      });

      const response = await request(app)
        .get('/api/location/search')
        .query({ query: 'test location' });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('countrycodes='),
        expect.any(Object)
      );
    });

    it('should handle search API errors', async () => {
      prismaMock.setting.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const response = await request(app)
        .get('/api/location/search')
        .query({ query: 'test location' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search locations');
    });
  });

  describe('POST /api/location/validate', () => {
    it('should include country code in validation when available', async () => {
      // Mock the country code setting
      prismaMock.setting.findFirst.mockResolvedValue({
        key: 'country_code',
        value: 'fr',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock the fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          display_name: 'Test Location',
          lat: '51.0000',
          lon: '0.0000'
        }]),
      });

      const response = await request(app)
        .post('/api/location/validate')
        .send({ query: 'test location' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('countrycodes=fr'),
        expect.any(Object)
      );
    });

    it('should handle invalid locations', async () => {
      prismaMock.setting.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const response = await request(app)
        .post('/api/location/validate')
        .send({ query: 'invalid location' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Location not found');
    });
  });
}); 