import fetch from 'node-fetch';
import { Prisma, PrismaClient } from '@prisma/client';
import { getSearchCategories, CategoryConfig } from './categoryConfig.js';
import { nominatimRateLimiter } from './nominatimRateLimiter.js';

const prisma = new PrismaClient();

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    amenity?: string;
    leisure?: string;
    tourism?: string;
    place?: string;
    highway?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Reverse geocoding to get location context
export async function reverseGeocode(lat: number, lon: number): Promise<{city?: string, postcode?: string, country?: string}> {
  try {
    await nominatimRateLimiter.waitForNextRequest();
    
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`, {
      headers: {
        'User-Agent': 'RandomWalk/1.0 (your-email@example.com)', // Nominatim requires User-Agent
      }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited by Nominatim');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      return {
        city: addr.city || addr.town || addr.village || addr.municipality,
        postcode: addr.postcode,
        country: addr.country
      };
    }
  } catch (error) {
    console.log(`Reverse geocoding failed for ${lat},${lon}:`, error instanceof Error ? error.message : error);
  }
  return {};
}

// Enhanced function to add geocoding information to places
export async function enhancePlacesWithGeocode(places: any[]): Promise<any[]> {
  console.log(`Enhancing ${places.length} places with reverse geocoding...`);
  
  const enhancedPlaces = [];
  
  for (const place of places) {
    try {
      // Get additional location context via reverse geocoding
      const geoInfo = await reverseGeocode(place.latitude, place.longitude);
      
      // Enhance the description with geocoding data
      const enhancedDescription = enhanceDescriptionWithGeocode(place.description, geoInfo);
      
      enhancedPlaces.push({
        ...place,
        description: enhancedDescription,
        geocodeInfo: geoInfo // Also include raw geocode info for frontend
      });
      
    } catch (error) {
      console.error(`Failed to enhance place ${place.name}:`, error);
      // Include the place without enhancement if geocoding fails
      enhancedPlaces.push(place);
    }
  }
  
  return enhancedPlaces;
}

// Helper function to enhance existing description with geocode information
function enhanceDescriptionWithGeocode(
  currentDescription: string, 
  geoInfo: {city?: string, postcode?: string, country?: string}
): string {
  const parts = currentDescription ? currentDescription.split(' • ') : [];
  
  // Check if we already have location information in the description
  const locationPartIndex = parts.findIndex(part => part.startsWith('📍'));
  
  if (locationPartIndex !== -1 && geoInfo.postcode) {
    // Location info exists, but check if we need to add postcode
    const locationPart = parts[locationPartIndex];
    const locationContent = locationPart.substring(2); // Remove "📍 " prefix
    
    // Check if postcode is already in the location part
    if (!locationContent.includes(geoInfo.postcode)) {
      // Add postcode to existing location info
      const updatedLocationContent = `${locationContent}, ${geoInfo.postcode}`;
      parts[locationPartIndex] = `📍 ${updatedLocationContent}`;
    }
  } else if (locationPartIndex === -1 && (geoInfo.city || geoInfo.postcode)) {
    // No location info exists, add it
    const locationParts = [];
    if (geoInfo.city) locationParts.push(geoInfo.city);
    if (geoInfo.postcode) locationParts.push(geoInfo.postcode);
    
    const locationString = `📍 ${locationParts.join(', ')}`;
    parts.unshift(locationString); // Add at the beginning
  }
  
  return parts.join(' • ');
}

export async function fetchPlaces(progressCallback?: (message: string) => void): Promise<Prisma.PlaceCreateInput[]> {
  try {
    // Get home coordinates from settings
    const homeCoordinates = await prisma.setting.findFirst({
      where: { key: 'home_coordinates' }
    });

    if (!homeCoordinates) {
      console.log('No home coordinates set, returning test data');
      return getTestPlaces();
    }

    const [lat, lon] = homeCoordinates.value.split(',').map(Number);
    if (!lat || !lon) {
      console.log('Invalid home coordinates, returning test data');
      return getTestPlaces();
    }

    progressCallback?.('🏠 Loading your location...');

    // Get configurable search ranges
    const searchRangesSetting = await prisma.setting.findFirst({
      where: { key: 'search_ranges' }
    });
    
    let searchRangesMiles = [5, 10, 15, 20, 40]; // Default ranges
    if (searchRangesSetting?.value) {
      try {
        const ranges = JSON.parse(searchRangesSetting.value);
        if (Array.isArray(ranges) && ranges.every(r => typeof r === 'number')) {
          searchRangesMiles = ranges;
        }
      } catch (error) {
        console.error('Failed to parse search ranges, using defaults:', error);
      }
    }

    // Convert miles to meters
    const radiuses = searchRangesMiles.map(miles => Math.round(miles * 1609.344));

    const allPlaces: Prisma.PlaceCreateInput[] = [];
    const seenOsmIds = new Set<string>();
    const seenCoordinates = new Set<string>();

    // Get configurable search categories
    const searchCategories = await getSearchCategories();
    const enabledCategories = searchCategories.filter(category => category.enabled);
    
    progressCallback?.(`🔍 Searching ${enabledCategories.length} place types across ${radiuses.length} distance bands...`);
    
    let totalQueries = enabledCategories.length * radiuses.length;
    let completedQueries = 0;
    
    // For each radius, search for different types of places
    for (const radius of radiuses) {
      const radiusMiles = Math.round(radius / 1609.344);
      
      for (let i = 0; i < enabledCategories.length; i++) {
        const category = enabledCategories[i];
        try {
          completedQueries++;
          const progressPercent = Math.round((completedQueries / totalQueries) * 100);
          progressCallback?.(`🔎 Searching for ${category.type} places within ${radiusMiles} miles... (${progressPercent}%)`);
          
          // Add delay between requests to avoid rate limiting
          if (completedQueries > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between requests
          }
          
          const query = buildOverpassQuery(lat, lon, radius, category.filters);
          const places = await fetchFromOverpass(query);
          
          // Process ALL places found (comprehensive search)
          const processedPromises = places.map(place => processOverpassElement(place, category.type as 'PARK' | 'TOURIST_ATTRACTION' | 'TOWN' | 'CITY' | 'PLAYGROUND', lat, lon));
          const processedPlaces = await Promise.all(processedPromises);
          const validPlaces = processedPlaces.filter(Boolean) as Prisma.PlaceCreateInput[];
          
          // Deduplicate places as we add them
          for (const place of validPlaces) {
            const osmId = place.osmId;
            const coordinates = `${place.latitude},${place.longitude}`;
            
            // Skip if we've already seen this osmId or these exact coordinates
            if (osmId && seenOsmIds.has(osmId)) {
              continue; // Duplicate osmId from different radius search
            }
            if (seenCoordinates.has(coordinates)) {
              continue; // Duplicate coordinates from different radius search
            }
            
            // Mark as seen and add to results
            if (osmId) {
              seenOsmIds.add(osmId);
            }
            seenCoordinates.add(coordinates);
            allPlaces.push(place);
          }
        } catch (error) {
          console.error(`Failed to fetch ${category.type} places within ${radius}m:`, error);
          progressCallback?.(`⚠️ Failed to fetch ${category.type} places within ${radiusMiles} miles, continuing...`);
        }
      }
    }

    progressCallback?.(`✅ Found ${allPlaces.length} unique places total`);
    return allPlaces.length > 0 ? allPlaces : getTestPlaces();

  } catch (error) {
    console.error('Error in fetchPlaces:', error);
    return getTestPlaces();
  }
}

function buildOverpassQuery(lat: number, lon: number, radius: number, filters: string[]): string {
  const filterQueries = filters.map(filter => `node[${filter}](around:${radius},${lat},${lon});way[${filter}](around:${radius},${lat},${lon});relation[${filter}](around:${radius},${lat},${lon});`).join('');
  
  return `
    [out:json][timeout:25];
    (
      ${filterQueries}
    );
    out tags center;
  `;
}

async function fetchFromOverpass(query: string, retries = 3): Promise<OverpassElement[]> {
  const overpassUrl = 'https://overpass-api.de/api/interpreter';

  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Add delay between requests to avoid rate limiting
      if (attempt > 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(overpassUrl, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (response.status === 429) {
        if (attempt < retries) {
          continue;
        }
        throw new Error(`Overpass API rate limited after ${retries} attempts`);
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      return data.elements || [];
    } catch (error) {
      if (attempt === retries) {
        console.error('Overpass API request failed after all retries:', error);
        return [];
      }
      // Silent retry for temporary failures
    }
  }
  
  return [];
}

async function processOverpassElement(
  element: OverpassElement, 
  locationType: 'PARK' | 'TOURIST_ATTRACTION' | 'TOWN' | 'CITY' | 'PLAYGROUND',
  homeLat: number,
  homeLon: number
): Promise<Prisma.PlaceCreateInput | null> {
  if (!element.tags?.name) {
    return null; // Skip places without names
  }

  // Get coordinates - use center coordinates for ways/relations, direct lat/lon for nodes
  let lat = element.lat || element.center?.lat;
  let lon = element.lon || element.center?.lon;

  // Skip if no coordinates available
  if (!lat || !lon) {
    return null; // Skip if no coordinates
  }

  const tags = element.tags;
  const distance = calculateDistance(homeLat, homeLon, lat, lon);
  
  // No reverse geocoding during ingestion - this will be done at display time for random selections
  const reverseGeoInfo = {};
  
  const description = buildDetailedDescription(tags, locationType, distance, reverseGeoInfo);

  return {
    name: element.tags.name,
    description,
    locationType,
    latitude: lat,
    longitude: lon,
    osmId: `${element.type}/${element.id}`,
    visitStatus: 'AVAILABLE',
    dateAdded: new Date(),
    lastVisited: null,
  };
}

function buildDetailedDescription(
  tags: Record<string, string | undefined>, 
  locationType: string, 
  distance: number, 
  reverseGeoInfo: {city?: string, postcode?: string, country?: string}
): string {
  const parts: string[] = [];

  // Add location information first
  const locationParts: string[] = [];
  
  // Address components from OSM tags
  if (tags['addr:street'] && tags['addr:housenumber']) {
    locationParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    locationParts.push(tags['addr:street']);
  }
  
  if (tags['addr:suburb'] || tags['addr:district']) {
    locationParts.push((tags['addr:suburb'] || tags['addr:district'])!);
  }
  
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || reverseGeoInfo.city;
  if (city) {
    locationParts.push(city);
  }
  
  const postcode = tags['addr:postcode'] || reverseGeoInfo.postcode;
  if (postcode) {
    locationParts.push(postcode);
  }
  
  // If no full address, try other location indicators - but be more specific
  if (locationParts.length === 0) {
    // For places like towns/villages, show the place type with the name if different
    if (tags.place && tags.place !== 'unclassified') {
      const placeTypeMap: Record<string, string> = {
        'hamlet': 'Hamlet',
        'village': 'Village', 
        'town': 'Town',
        'city': 'City',
        'suburb': 'Suburb',
        'neighbourhood': 'Neighbourhood',
        'locality': 'Locality'
      };
      const placeType = placeTypeMap[tags.place] || tags.place;
      
      // Only add if the place type is different from the main location type
      if (placeType.toLowerCase() !== locationType.toLowerCase()) {
        locationParts.push(placeType);
      }
    }
    
    // Add containing areas
    if (tags['is_in:town']) {
      locationParts.push(tags['is_in:town']!);
    }
    if (tags['is_in:city']) {
      locationParts.push(tags['is_in:city']!);
    }
    if (tags['is_in:county']) {
      locationParts.push(tags['is_in:county']!);
    }
  }
  
  if (locationParts.length > 0) {
    parts.push(`📍 ${locationParts.join(', ')}`);
  }

  // Add specific type information if different from the main category
  const specificType = getSpecificType(tags);
  if (specificType && specificType.toLowerCase() !== locationType.toLowerCase().replace('_', ' ')) {
    parts.push(`🏛️ ${specificType}`);
  }

  // Add useful additional information
  if (tags.website) {
    parts.push(`🌐 ${tags.website}`);
  }
  
  if (tags.phone) {
    parts.push(`📞 ${tags.phone}`);
  }
  
  if (tags.opening_hours) {
    parts.push(`🕒 ${formatOpeningHours(tags.opening_hours)}`);
  }
  
  if (tags.fee === 'yes') {
    parts.push('💰 Entry fee required');
  } else if (tags.fee === 'no') {
    parts.push('🆓 Free entry');
  }
  
  if (tags.wheelchair === 'yes') {
    parts.push('♿ Wheelchair accessible');
  }
  
  // Use description or short_description as fallback
  const description = tags.description || tags.short_description;
  if (description) {
    parts.push(`ℹ️ ${description}`);
  }

  return parts.join(' • ');
}

function getSpecificType(tags: Record<string, string | undefined>): string | null {
  // Return more specific type information if available
  if (tags.amenity) {
    return getAmenityDescription(tags.amenity);
  }
  if (tags.tourism) {
    return getTourismDescription(tags.tourism);
  }
  if (tags.leisure) {
    return getLeisureDescription(tags.leisure);
  }
  if (tags.historic) {
    return getHistoricDescription(tags.historic);
  }
  return null;
}

function getAmenityDescription(amenity: string): string | null {
  const amenityTypes: Record<string, string> = {
    'theatre': 'Theatre',
    'cinema': 'Cinema',
    'library': 'Library',
    'community_centre': 'Community centre',
    'museum': 'Museum',
    'art_gallery': 'Art gallery',
    'restaurant': 'Restaurant',
    'cafe': 'Café',
    'pub': 'Pub',
    'bar': 'Bar',
    'playground': 'Playground',
    'toilets': 'Public toilets',
    'parking': 'Parking',
    'hospital': 'Hospital',
    'school': 'School',
    'university': 'University',
    'place_of_worship': 'Place of worship',
    'townhall': 'Town hall',
    'post_office': 'Post office',
    'bank': 'Bank',
    'marketplace': 'Marketplace'
  };
  
  return amenityTypes[amenity] || null;
}

function getTourismDescription(tourism: string): string | null {
  const tourismTypes: Record<string, string> = {
    'attraction': 'Tourist attraction',
    'museum': 'Museum',
    'viewpoint': 'Viewpoint',
    'castle': 'Castle',
    'monument': 'Monument',
    'gallery': 'Gallery',
    'zoo': 'Zoo',
    'theme_park': 'Theme park',
    'artwork': 'Public artwork',
    'information': 'Tourist information',
    'hotel': 'Hotel',
    'guest_house': 'Guest house',
    'picnic_site': 'Picnic site',
    'camp_site': 'Campsite'
  };
  
  return tourismTypes[tourism] || null;
}

function getLeisureDescription(leisure: string): string | null {
  const leisureTypes: Record<string, string> = {
    'park': 'Park',
    'garden': 'Garden',
    'nature_reserve': 'Nature reserve',
    'recreation_ground': 'Recreation ground',
    'common': 'Common land',
    'dog_park': 'Dog park',
    'playground': 'Playground',
    'sports_centre': 'Sports centre',
    'swimming_pool': 'Swimming pool',
    'golf_course': 'Golf course',
    'pitch': 'Sports pitch',
    'track': 'Running track',
    'marina': 'Marina',
    'slipway': 'Boat slipway'
  };
  
  return leisureTypes[leisure] || null;
}

function getHistoricDescription(historic: string): string | null {
  const historicTypes: Record<string, string> = {
    'castle': 'Historic castle',
    'monument': 'Historic monument',
    'memorial': 'Memorial',
    'ruins': 'Historic ruins',
    'archaeological_site': 'Archaeological site',
    'building': 'Historic building',
    'church': 'Historic church',
    'manor': 'Historic manor',
    'fort': 'Historic fort',
    'battlefield': 'Historic battlefield'
  };
  
  return historicTypes[historic] || null;
}

function formatOpeningHours(hours: string | undefined): string {
  if (!hours) return '';
  
  // Simplify complex opening hours for display
  if (hours.includes('24/7')) {
    return 'Open 24/7';
  }
  if (hours.length > 50) {
    return 'See website for opening hours';
  }
  return hours;
}

function getTestPlaces(): Prisma.PlaceCreateInput[] {
  return [
    {
      name: 'Test Park',
      description: 'A sample park for testing - real places will appear once home address is set',
      locationType: 'PARK',
      latitude: 51.0000,
      longitude: 0.0000,
      osmId: 'test123',
      visitStatus: 'AVAILABLE',
      dateAdded: new Date(),
      lastVisited: null,
    }
  ];
} 