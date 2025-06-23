interface Place {
  osmId?: string | null;
  latitude: number;
  longitude: number;
}

// Utility function to generate OSM links
export const generateOSMLink = (place: Place): string | null => {
  // If we have an osmId, use it to link directly to the OSM object
  if (place.osmId && place.osmId.includes('/')) {
    const [type, id] = place.osmId.split('/');
    return `https://www.openstreetmap.org/${type}/${id}`;
  }
  
  // Fallback to coordinate-based link
  if (place.latitude && place.longitude) {
    return `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}&zoom=16`;
  }
  
  return null;
}; 