/**
 * Parse place description to extract and format different components
 */
export interface ParsedDescription {
  parts: Array<{
    type: 'text' | 'website' | 'phone';
    content: string;
    url?: string;
  }>;
}

/**
 * Parse a place description that contains various info separated by " • "
 * and identify websites that should be clickable links
 */
export function parseDescription(description: string): ParsedDescription {
  if (!description) {
    return { parts: [] };
  }

  const parts = description.split(' • ').map(part => {
    // Website links (🌐 prefix)
    if (part.startsWith('🌐 ')) {
      const url = part.substring(2).trim();
      return {
        type: 'website' as const,
        content: part,
        url: url.startsWith('http') ? url : `https://${url}`
      };
    }
    
    // Phone numbers (📞 prefix)
    if (part.startsWith('📞 ')) {
      const phone = part.substring(2).trim();
      return {
        type: 'phone' as const,
        content: part,
        url: `tel:${phone}`
      };
    }
    
    // Regular text
    return {
      type: 'text' as const,
      content: part
    };
  });

  return { parts };
}

/**
 * Extract the human-readable address from a place description, if present.
 * Descriptions are " • "-separated parts; the address is the part starting
 * with the "📍 " marker emitted by the OSM/reverse-geocoding pipeline.
 */
export function extractAddress(description: string | null): string | null {
  if (!description) return null;
  const parts = description.split(' • ');
  const locationPart = parts.find(p => p.startsWith('📍 '));
  if (!locationPart) return null;
  const trimmed = locationPart.replace(/^📍\s*/, '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extract postcode from description
 */
export function extractPostcode(description: string | null): string | null {
  if (!description) return null;
  
  // UK postcode pattern
  const postcodeMatch = description.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  return postcodeMatch ? postcodeMatch[0] : null;
}

/**
 * Case-insensitive search predicate for the Places page filter. Matches the
 * query against any descriptive text we hold for a place: name, raw and
 * formatted locationType, description, and notes. Empty/whitespace queries
 * match everything.
 */
export interface SearchablePlace {
  name: string;
  locationType: string;
  description?: string | null;
  notes?: string | null;
}

export function placeMatchesQuery(place: SearchablePlace, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystacks: (string | null | undefined)[] = [
    place.name,
    place.locationType,
    formatCategoryName(place.locationType),
    place.description,
    place.notes,
  ];
  return haystacks.some(field => field?.toLowerCase().includes(q));
}

/**
 * Format category name for display
 */
export function formatCategoryName(locationType: string): string {
  return locationType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format a date string for user-friendly display
 */
export function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Less than 1 minute ago
  if (diffMinutes < 1) {
    return 'Just now';
  }
  
  // Less than 1 hour ago
  if (diffHours < 1) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }
  
  // Less than 24 hours ago
  if (diffDays < 1) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  
  // Less than 7 days ago
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  
  // Less than 30 days ago
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  
  // More than 30 days ago - show actual date
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Re-export OSM utilities
export { generateOSMLink } from './osm'; 