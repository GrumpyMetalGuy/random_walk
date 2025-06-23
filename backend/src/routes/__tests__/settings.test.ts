import { prismaMock } from '../../test/setup.js';
import request from 'supertest';
import { app } from '../../app.js';
import { Setting } from '@prisma/client';
import * as geocoding from '../../services/geocoding.js';
import { AuthService } from '../../services/auth.js';

// Mock the geocoding module
jest.mock('../../services/geocoding');
const mockGeocodeAddress = geocoding.geocodeAddress as jest.Mock;

describe('Settings API', () => {
  let authToken: string;

  beforeEach(() => {
    mockGeocodeAddress.mockClear();
    
    // Create a test token for authentication (admin required for settings)
    const testUser = {
      userId: 1,
      username: 'testadmin',
      role: 'ADMIN'
    };
    authToken = AuthService.generateToken(testUser);
  });

  const mockSetting: Setting = {
    key: 'home_address',
    value: '51.0000,0.0000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('PUT /', () => {
    it('should store country code when setting home address', async () => {
      // Mock geocoding call to return address with country code
      mockGeocodeAddress.mockResolvedValueOnce({
        lat: 51.0000,
        lon: 0.0000,
        country_code: 'fr'
      });

      // Mock the database calls
      prismaMock.setting.upsert.mockResolvedValueOnce({  // For country_code
        key: 'country_code',
        value: 'fr',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({  // For home_coordinates
        key: 'home_coordinates',
        value: '51,0',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(mockSetting);  // For home_address

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: 'home_address',
          value: '123 Test Street, Paris, France'
        });

      expect(response.status).toBe(200);
      expect(mockGeocodeAddress).toHaveBeenCalledTimes(1);
      expect(mockGeocodeAddress).toHaveBeenCalledWith('123 Test Street, Paris, France');
      
      // Verify country code was stored
      expect(prismaMock.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'country_code' },
          create: { key: 'country_code', value: 'fr' },
          update: { value: 'fr' }
        })
      );
      
      // Verify coordinates were stored
      expect(prismaMock.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'home_coordinates' },
          create: { key: 'home_coordinates', value: '51,0' },
          update: { value: '51,0' }
        })
      );
    });

    it('should handle address not found', async () => {
      mockGeocodeAddress.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${authToken}`)
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
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: 'home_address',
          value: 'Test Address'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update setting');
    });
  });
}); 