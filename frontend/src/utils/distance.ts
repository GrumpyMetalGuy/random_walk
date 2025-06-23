export type DistanceUnit = 'miles' | 'kilometers';

/**
 * Convert miles to kilometers
 */
export const milesToKilometers = (miles: number): number => {
  return miles * 1.60934;
};

/**
 * Convert kilometers to miles
 */
export const kilometersToMiles = (kilometers: number): number => {
  return kilometers / 1.60934;
};

/**
 * Convert distance from one unit to another
 */
export const convertDistance = (distance: number, fromUnit: DistanceUnit, toUnit: DistanceUnit): number => {
  if (fromUnit === toUnit) return distance;
  
  if (fromUnit === 'miles' && toUnit === 'kilometers') {
    return milesToKilometers(distance);
  }
  
  if (fromUnit === 'kilometers' && toUnit === 'miles') {
    return kilometersToMiles(distance);
  }
  
  return distance;
};

/**
 * Format distance with the appropriate unit label
 */
export const formatDistance = (distance: number, unit: DistanceUnit, precision: number = 1): string => {
  const rounded = Number(distance.toFixed(precision));
  return `${rounded} ${unit === 'miles' ? 'mi' : 'km'}`;
};

/**
 * Get the appropriate unit abbreviation
 */
export const getUnitAbbreviation = (unit: DistanceUnit): string => {
  return unit === 'miles' ? 'mi' : 'km';
};

/**
 * Parse distance unit preference from settings
 */
export const parseDistanceUnit = (unitString: string | undefined): DistanceUnit => {
  return unitString === 'kilometers' ? 'kilometers' : 'miles';
}; 