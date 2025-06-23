// Shared distance constants for consistent frontend/backend behavior
export const DISTANCE_OPTIONS_MILES = [5, 10, 15, 20, 40] as const;

export type DistanceOptionMiles = typeof DISTANCE_OPTIONS_MILES[number]; 