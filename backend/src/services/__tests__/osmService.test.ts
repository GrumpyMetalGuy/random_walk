import {
  formatStructuredAddress,
  buildLocationString,
  enhanceDescriptionWithGeocode,
} from '../osmService.js';

describe('formatStructuredAddress', () => {
  it('joins house number with the road when both are present', () => {
    expect(
      formatStructuredAddress({
        house_number: '10',
        road: 'Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
      })
    ).toBe('10 Downing Street, London, SW1A 2AA');
  });

  it('falls back to road alone when no house number', () => {
    expect(
      formatStructuredAddress({
        road: 'High Street',
        suburb: 'Old Town',
        town: 'Hastings',
        postcode: 'TN34 3EN',
      })
    ).toBe('High Street, Old Town, Hastings, TN34 3EN');
  });

  it('uses pedestrian/footway/cycleway/path as a road fallback', () => {
    expect(
      formatStructuredAddress({ pedestrian: 'Carnaby Street', city: 'London' })
    ).toBe('Carnaby Street, London');
    expect(
      formatStructuredAddress({ footway: 'The Mall', city: 'London' })
    ).toBe('The Mall, London');
  });

  it('drops duplicate parts (e.g. when suburb equals city)', () => {
    expect(
      formatStructuredAddress({
        road: 'Main Road',
        suburb: 'Hastings',
        city: 'Hastings',
        postcode: 'TN34 3EN',
      })
    ).toBe('Main Road, Hastings, TN34 3EN');
  });

  it('returns null when nothing usable is present', () => {
    expect(formatStructuredAddress({})).toBeNull();
    expect(formatStructuredAddress({ country: 'United Kingdom' })).toBeNull();
  });
});

describe('buildLocationString', () => {
  it('prefers the formatted address over city/postcode', () => {
    expect(
      buildLocationString({
        formattedAddress: '10 Downing Street, London, SW1A 2AA',
        city: 'London',
        postcode: 'SW1A 2AA',
      })
    ).toBe('10 Downing Street, London, SW1A 2AA');
  });

  it('falls back to city + postcode when no formatted address', () => {
    expect(buildLocationString({ city: 'London', postcode: 'SW1A 2AA' })).toBe(
      'London, SW1A 2AA'
    );
  });

  it('returns null when nothing is available', () => {
    expect(buildLocationString({})).toBeNull();
  });
});

describe('enhanceDescriptionWithGeocode', () => {
  it('prepends a 📍 part to a description that has none', () => {
    const result = enhanceDescriptionWithGeocode('🏛️ Park • 🌐 example.com', {
      formattedAddress: 'High Street, Anytown, AN1 2BC',
    });
    expect(result).toBe('📍 High Street, Anytown, AN1 2BC • 🏛️ Park • 🌐 example.com');
  });

  it('replaces the existing 📍 part with the richer geocoded address', () => {
    const result = enhanceDescriptionWithGeocode('📍 Anytown, AN1 2BC • 🏛️ Park', {
      formattedAddress: '10 High Street, Old Town, Anytown, AN1 2BC',
    });
    expect(result).toBe('📍 10 High Street, Old Town, Anytown, AN1 2BC • 🏛️ Park');
  });

  it('leaves the description untouched when geocoding produced nothing', () => {
    expect(enhanceDescriptionWithGeocode('🏛️ Park', {})).toBe('🏛️ Park');
  });

  it('handles a null/empty description by emitting just the 📍 part', () => {
    expect(
      enhanceDescriptionWithGeocode(null, { formattedAddress: 'Somewhere' })
    ).toBe('📍 Somewhere');
  });
});
