import { prismaMock } from '../../test/setup';
import request from 'supertest';
import { app } from '../../app';
import { Setting } from '@prisma/client';
import * as geocoding from '../../services/geocoding';

// Mock the geocoding module
jest.mock('../../services/geocoding');
const mockGeocodeAddress = geocoding.geocodeAddress as jest.Mock;

describe('Settings API', () => {
  beforeEach(() => {
    mockGeocodeAddress.mockClear();
  });

  const mockSetting: Setting = {
    key: 'home_address',
    value: '51.0000,0.0000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('PUT /', () => {
    it('should store country code when setting home address', async () => {
      // Mock first geocoding call to get country
      mockGeocodeAddress.mockResolvedValueOnce({
        lat: 51.0000,
        lon: 0.0000,
        country_code: 'fr'
      });

      // Mock second geocoding call with country code
      mockGeocodeAddress.mockResolvedValueOnce({
        lat: 51.0000,
        lon: 0.0000,
        country_code: 'fr'
      });

      // Mock the database calls
      prismaMock.setting.upsert.mockResolvedValueOnce(mockSetting)  // For home_address
        .mockResolvedValueOnce({  // For country_code
          key: 'country_code',
          value: 'fr',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const response = await request(app)
        .put('/api/settings')
        .send({
          key: 'home_address',
          value: '123 Test Street, Paris, France'
        });

      expect(response.status).toBe(200);
      expect(mockGeocodeAddress).toHaveBeenCalledTimes(2);
      expect(mockGeocodeAddress).toHaveBeenCalledWith('123 Test Street, Paris, France');
      expect(mockGeocodeAddress).toHaveBeenCalledWith('123 Test Street, Paris, France', 'fr');
      expect(prismaMock.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'country_code' },
          create: { key: 'country_code', value: 'fr' },
          update: { value: 'fr' }
        })
      );
    });

    it('should handle address not found', async () => {
      mockGeocodeAddress.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/settings')
        .send({
          key: 'home_address',
          value: 'Invalid Address'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Address not found');
      expect(mockGeocodeAddress).toHaveBeenCalledTimes(1);
    });

    it('should handle geocoding failure', async () => {
      mockGeocodeAddress.mockRejectedValueOnce(new Error('Geocoding failed'));

      const response = await request(app)
        .put('/api/settings')
        .send({
          key: 'home_address',
          value: 'Test Address'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update setting');
    });
  });
}); 