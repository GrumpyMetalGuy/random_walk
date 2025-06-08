import fetch from 'node-fetch';

interface GeocodingResult {
  lat: number;
  lon: number;
  country_code?: string;
}

export async function geocodeAddress(address: string, countryCode?: string): Promise<GeocodingResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodedAddress}&` +
      `format=json&` +
      `limit=1&` +
      `${countryCode ? `countrycodes=${countryCode.toLowerCase()}&` : ''}` +
      `addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Random-Walk/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    
    if (data.length === 0) {
      console.error('No location found for address:', address);
      return null;
    }

    const result = data[0];
    console.log('Geocoded location:', result.display_name);
    
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