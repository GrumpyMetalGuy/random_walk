import { describe, it, expect } from 'vitest';
import { placeMatchesQuery } from '../index';

describe('placeMatchesQuery', () => {
  const place = {
    name: 'Hyde Park',
    locationType: 'PARK',
    description: '📍 Westminster, London, W2 • 🌐 royalparks.org.uk',
    notes: 'Beautiful in autumn, great for a long walk.',
  };

  it('matches everything for an empty/whitespace query', () => {
    expect(placeMatchesQuery(place, '')).toBe(true);
    expect(placeMatchesQuery(place, '   ')).toBe(true);
  });

  it('matches against the place name (case-insensitive)', () => {
    expect(placeMatchesQuery(place, 'hyde')).toBe(true);
    expect(placeMatchesQuery(place, 'HYDE')).toBe(true);
  });

  it('matches the raw and the formatted locationType', () => {
    expect(placeMatchesQuery(place, 'PARK')).toBe(true);
    expect(placeMatchesQuery(place, 'park')).toBe(true);
    // formatCategoryName turns "TOURIST_ATTRACTION" into "Tourist Attraction"
    const attraction = { ...place, locationType: 'TOURIST_ATTRACTION' };
    expect(placeMatchesQuery(attraction, 'tourist attraction')).toBe(true);
  });

  it('matches against the description text', () => {
    expect(placeMatchesQuery(place, 'royalparks')).toBe(true);
    expect(placeMatchesQuery(place, 'westminster')).toBe(true);
  });

  it('matches against the notes', () => {
    expect(placeMatchesQuery(place, 'autumn')).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(placeMatchesQuery(place, 'kayaking')).toBe(false);
  });

  it('handles missing description and notes gracefully', () => {
    const sparse = { name: 'Town Square', locationType: 'TOWN' };
    expect(placeMatchesQuery(sparse, 'town')).toBe(true);
    expect(placeMatchesQuery(sparse, 'square')).toBe(true);
    expect(placeMatchesQuery(sparse, 'autumn')).toBe(false);
  });
});
