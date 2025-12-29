import fetch from 'node-fetch';
import { nominatimRateLimiter } from './nominatimRateLimiter.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getNominatimHeaders(): Promise<Record<string, string>> {
  // Read required contact details from settings
  const settings = await prisma.setting.findMany({
    where: {
      key: { in: ['nominatim_contact_email', 'nominatim_contact_url', 'app_name'] }
    }
  });
  const get = (k: string) => settings.find(s => s.key === k)?.value?.trim();
  const contactEmail = get('nominatim_contact_email');
  const contactUrl = get('nominatim_contact_url');
  const appName = get('app_name') || 'Random Walk';

  // Construct User-Agent per Nominatim policy
  // Include a real contact email or URL
  // Example: Random Walk/1.0 (+https://your-site; admin@example.com)
  const contactParts: string[] = [];
  if (contactUrl) contactParts.push(contactUrl);
  if (contactEmail) contactParts.push(contactEmail);
  const contactStr = contactParts.length > 0 ? ` (+${contactParts.join('; ')})` : '';
  const userAgent = `${appName}/1.0${contactStr}`;
  if (!contactEmail && !contactUrl) {
    console.warn('Nominatim contact details missing (email/url). Please configure via admin settings to avoid 403 responses.');
  }

  const headers: Record<string, string> = {
    'User-Agent': userAgent
  };
  if (contactUrl) {
    headers['Referer'] = contactUrl;
  }
  return headers;
}

interface GeocodingResult {
  lat: number;
  lon: number;
  country_code?: string;
}

export async function geocodeAddress(address: string, countryCode?: string): Promise<GeocodingResult | null> {
  try {
    console.log(`Geocoding address: ${address}`);
    await nominatimRateLimiter.waitForNextRequest();
    
    const encodedAddress = encodeURIComponent(address);

    const headers = await getNominatimHeaders();

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodedAddress}&` +
      `format=json&` +
      `limit=1&` +
      `${countryCode ? `countrycodes=${countryCode.toLowerCase()}&` : ''}` +
      `addressdetails=1`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Geocoding request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.length === 0) {
      console.error('No location found for address:', address);
      return null;
    }

    const result = data[0];
    console.log('Successfully geocoded to:', result.display_name);
    
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      country_code: result.address?.country_code
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
} 