import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DistanceUnit, convertDistance, formatDistance, parseDistanceUnit, getUnitAbbreviation } from '../utils/distance';
import { parseDescription, extractPostcode, formatCategoryName, generateOSMLink } from '../utils';
import { useAuth } from '../contexts/AuthContext';

// Using relative URLs since frontend and backend are same-origin

interface Place {
  id: number;
  name: string;
  description: string | null;
  locationType: string;
  distance?: number;
  visitStatus: 'AVAILABLE' | 'PLANNED' | 'VISITED' | 'IGNORED';
  osmId?: string | null;
  latitude: number;
  longitude: number;
  lastVisited?: string | null;
  lastIgnored?: string | null;
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number>(() => {
    // Load saved distance from localStorage, fallback to 5
    const saved = localStorage.getItem('selectedDistance');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [textFilter, setTextFilter] = useState<string>('');
  const [selectedPlacesCount, setSelectedPlacesCount] = useState<number>(() => {
    // Load saved places count from localStorage, fallback to 5
    const saved = localStorage.getItem('selectedPlacesCount');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [searchProgress, setSearchProgress] = useState<string>('');
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null);
  const [shouldGenerateMore, setShouldGenerateMore] = useState<boolean>(false);
  const [lastSearchMeta, setLastSearchMeta] = useState<any>(null);
  const [distances, setDistances] = useState<number[]>([5, 10, 15, 20, 40]); // Default fallback in miles
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');

  const categories = ['TOWN', 'CITY', 'TOURIST_ATTRACTION', 'PARK', 'PLAYGROUND'];

  // Helper functions for places count controls
  const incrementPlacesCount = () => {
    const newCount = Math.min(selectedPlacesCount + 1, 20);
    setSelectedPlacesCount(newCount);
    localStorage.setItem('selectedPlacesCount', newCount.toString());
  };

  const decrementPlacesCount = () => {
    const newCount = Math.max(selectedPlacesCount - 1, 1);
    setSelectedPlacesCount(newCount);
    localStorage.setItem('selectedPlacesCount', newCount.toString());
  };

  // Save distance selection to localStorage when it changes
  const handleDistanceChange = (distance: number) => {
    setSelectedDistance(distance);
    localStorage.setItem('selectedDistance', distance.toString());
  };

  useEffect(() => {
    // Check if setup is complete
    async function checkSetup() {
      try {
        const response = await axios.get('/api/settings');
        const settings = response.data;
        const setupComplete = settings.find((s: any) => s.key === 'setup_complete')?.value === 'true';
        
        // Only redirect to admin if user is admin AND setup is not complete
        if (!setupComplete && user?.role === 'ADMIN') {
          navigate('/admin');
          return;
        }

        // Load distance unit preference
        const distanceUnitSetting = settings.find((s: any) => s.key === 'distance_unit');
        const unit = parseDistanceUnit(distanceUnitSetting?.value);
        setDistanceUnit(unit);

        // Load configurable search ranges (stored in miles, convert if needed)
        const searchRangesSetting = settings.find((s: any) => s.key === 'search_ranges');
        if (searchRangesSetting?.value) {
          try {
            const ranges = JSON.parse(searchRangesSetting.value);
            if (Array.isArray(ranges) && ranges.every((r: any) => typeof r === 'number')) {
              const sortedRanges = ranges.sort((a: number, b: number) => a - b);
              // Convert ranges to user's preferred unit for display
              const convertedRanges = unit === 'kilometers' 
                ? sortedRanges.map(r => Math.round(convertDistance(r, 'miles', 'kilometers')))
                : sortedRanges;
              setDistances(convertedRanges);
            }
          } catch (error) {
            console.error('Failed to parse search ranges, using defaults:', error);
          }
        }

        // Only fetch planned and visited places on load
        setSearchProgress('Loading your saved places...');
        const placesResponse = await axios.get(`/api/places?exclude=AVAILABLE`);
        const placesData = placesResponse.data;
        setPlaces(placesData);
        setLoading(false);
        setSearchProgress('');
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setError('Failed to load application settings');
        setLoading(false);
        setSearchProgress('');
      }
    }
    
    checkSetup();
  }, [navigate, user?.role]);

  // Separate effect to validate selected distance when distances change
  useEffect(() => {
    if (distances.length > 0 && !distances.includes(selectedDistance)) {
      const newDistance = distances[0];
      setSelectedDistance(newDistance);
      localStorage.setItem('selectedDistance', newDistance.toString());
    }
  }, [distances, selectedDistance]);

  const handleGeneratePlaces = async () => {
    setSearching(true);
    setError(null);
    setSearchProgress('🔍 Searching for places near you...');
    setShouldGenerateMore(false);
    setLastSearchMeta(null);
    
    // Clear previous available places at the start of search
    setPlaces(places => places.filter(p => p.visitStatus !== 'AVAILABLE'));
    
    // Set up progress timeouts that we can cancel if request completes quickly
    const progressTimeouts: number[] = [];
    
    try {
      // Only show progress updates if request takes time
      progressTimeouts.push(
        setTimeout(() => setSearchProgress('📊 Checking database...'), 300),
        setTimeout(() => setSearchProgress('📍 Finding places within your area...'), 800)
      );
      
      // Convert distance back to miles for API if needed (backend expects miles)
      const distanceInMiles = distanceUnit === 'kilometers' 
        ? convertDistance(selectedDistance, 'kilometers', 'miles')
        : selectedDistance;
      
      const response = await axios.post(`/api/places/discover`, {
        distance: distanceInMiles,
        categories: selectedCategories.length > 0 ? selectedCategories : categories,
        count: selectedPlacesCount,
        textFilter: textFilter.trim() || undefined,
      });
      
      // Clear any pending progress timeouts since request completed
      progressTimeouts.forEach(clearTimeout);
      
      // Handle new response format with places and metadata
      const responseData = response.data;
      const newPlaces = responseData.places || responseData; // Support both new and legacy format
      const meta = responseData.meta;
      
      if (Array.isArray(newPlaces) && newPlaces.length === 0) {
        setError('No places found within the selected distance and categories. Try increasing the distance or selecting different categories.');
        setSearchProgress('');
        // Note: Available places already cleared above, so no old results will show
      } else {
        // Show preparing message only if we actually have results
        setSearchProgress('✨ Preparing your personalized recommendations...');
        
        // Small delay to show the preparing message
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Add new places to the existing planned and visited places
        setPlaces(places => [
          ...places, // This now only contains non-available places due to clearing above
          ...newPlaces
        ]);
        setLastSearchTime(new Date());
        setLastSearchMeta(meta);
        setShouldGenerateMore(meta?.shouldGenerateMore || false);
        
        // Show different messages based on whether we got all requested places
        if (meta?.shouldGenerateMore) {
          setSearchProgress(`✅ Found ${newPlaces.length} places (${meta.found} matched your criteria, but you requested ${meta.requested}). Consider generating more places for better results!`);
        } else {
          setSearchProgress(`✅ Found ${newPlaces.length} new places to explore!`);
        }
        
        // Clear success message after 5 seconds (longer for the generation message)
        setTimeout(() => setSearchProgress(''), 5000);
      }
    } catch (error) {
      // Clear any pending progress timeouts on error
      progressTimeouts.forEach(clearTimeout);
      
      console.error('Failed to fetch places:', error);
      setError('Failed to find places. Please try again.');
      setSearchProgress('');
      // Note: Available places already cleared above, so no old results will show
    } finally {
      setSearching(false);
    }
  };

  const handlePlanVisit = async (placeId: number) => {
    try {
      const response = await axios.post(`/api/places/${placeId}/plan`);
      const updatedPlace = response.data;
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to plan place visit:', error);
    }
  };

  const handleCancelPlan = async (placeId: number) => {
    try {
      await axios.post(`/api/places/${placeId}/unplan`);
      // Remove the place entirely instead of updating its status
      setPlaces(places => places.filter(place => place.id !== placeId));
    } catch (error) {
      console.error('Failed to cancel plan:', error);
    }
  };

  const handleVisit = async (placeId: number) => {
    try {
      const response = await axios.post(`/api/places/${placeId}/visit`);
      const updatedPlace = response.data;
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to mark place as visited:', error);
    }
  };

  const handleUnvisit = async (placeId: number) => {
    try {
      const response = await axios.post(`/api/places/${placeId}/unvisit`);
      const updatedPlace = response.data;
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to unmark place as visited:', error);
    }
  };

  const handleIgnore = async (placeId: number) => {
    try {
      await axios.post(`/api/places/${placeId}/ignore`);
      // Remove from the list instead of updating status
      setPlaces(places => places.filter(place => place.id !== placeId));
    } catch (error) {
      console.error('Failed to ignore place:', error);
    }
  };

  const renderPlace = (place: Place) => {
    const postcode = extractPostcode(place.description);
    const parsedDescription = parseDescription(place.description || '');
    
    return (
      <div
        key={place.id}
        className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-lg font-medium">{place.name}</h4>
            {place.description && (
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                {parsedDescription.parts.map((part, index) => (
                  <span key={index}>
                    {part.type === 'website' ? (
                      <a
                        href={part.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      >
                        {part.content}
                      </a>
                    ) : part.type === 'phone' ? (
                      <a
                        href={part.url}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      >
                        {part.content}
                      </a>
                    ) : (
                      <span>{part.content}</span>
                    )}
                    {index < parsedDescription.parts.length - 1 && ' • '}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {formatCategoryName(place.locationType)}
              {place.distance !== undefined && ` • ${formatDistance(
                distanceUnit === 'kilometers' 
                  ? convertDistance(place.distance, 'miles', 'kilometers')
                  : place.distance, 
                distanceUnit
              )} away`}
              {postcode && ` • ${postcode}`}
              {(() => {
                const osmLink = generateOSMLink(place);
                return osmLink && (
                  <>
                    {' • '}
                    <a
                      href={osmLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      title="View on OpenStreetMap"
                    >
                      🗺️ OSM
                    </a>
                  </>
                );
              })()}
            </p>
          </div>
        <div className="flex gap-2">
          {place.visitStatus === 'AVAILABLE' && (
            <>
              <button
                onClick={() => handlePlanVisit(place.id)}
                className="btn-primary"
              >
                Plan to Visit
              </button>
              <button
                onClick={() => handleIgnore(place.id)}
                className="btn-secondary"
              >
                Ignore
              </button>
            </>
          )}
          {place.visitStatus === 'PLANNED' && (
            <>
              <button
                onClick={() => handleVisit(place.id)}
                className="btn-primary"
              >
                Mark as Visited
              </button>
              <button
                onClick={() => handleCancelPlan(place.id)}
                className="btn-secondary"
              >
                Cancel Plan
              </button>
            </>
          )}
          {place.visitStatus === 'VISITED' && (
            <button
              onClick={() => handleUnvisit(place.id)}
              className="btn-secondary"
            >
              Unmark as Visited
            </button>
          )}
        </div>
      </div>
    </div>
    );
  };

  const availablePlaces = places.filter(p => p.visitStatus === 'AVAILABLE');
  const plannedPlaces = places.filter(p => p.visitStatus === 'PLANNED');

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Find Places to Visit</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Distance ({getUnitAbbreviation(distanceUnit)})</label>
            <select
              value={selectedDistance}
              onChange={(e) => handleDistanceChange(Number(e.target.value))}
              className="input-primary"
            >
              {distances.map((distance: number) => (
                <option key={distance} value={distance}>
                  Within {distance} {getUnitAbbreviation(distanceUnit)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Number of Places</label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={decrementPlacesCount}
                disabled={selectedPlacesCount <= 1}
                className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center font-medium">
                {selectedPlacesCount}
              </span>
              <button
                type="button"
                onClick={incrementPlacesCount}
                disabled={selectedPlacesCount >= 20}
                className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                (1-20 places)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Categories (optional)</label>
            <div className="space-y-2">
              {categories.map(category => (
                <label key={category} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories([...selectedCategories, category]);
                      } else {
                        setSelectedCategories(selectedCategories.filter(c => c !== category));
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                  />
                  <span className="ml-2">{formatCategoryName(category)}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Text Filter (optional)</label>
            <input
              type="text"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Search places by name or description..."
              className="input-primary w-full"
            />
            {textFilter && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Searching for places containing "{textFilter}"
              </p>
            )}
          </div>

          {/* Search Progress Indicator */}
          {searchProgress && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-center space-x-3">
                {searching && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  {searchProgress}
                </span>
              </div>
            </div>
          )}

          {/* Last Search Info */}
          {lastSearchTime && !searching && (
            <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              🕒 Last search: {lastSearchTime.toLocaleTimeString()}
              <span className="ml-2 text-green-600 dark:text-green-400">
                • Places updated successfully
              </span>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleGeneratePlaces}
            disabled={loading || searching}
            className={`btn-primary w-full ${searching ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {searching ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Searching for places...</span>
              </span>
            ) : loading ? (
              'Loading...'
            ) : (
              '🔍 Find me somewhere to visit'
            )}
          </button>
        </div>
      </div>

      {/* Generate More Places Notice */}
      {shouldGenerateMore && lastSearchMeta && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                Need More Places?
              </h3>
              <p className="text-amber-700 dark:text-amber-300 mb-3">
                You requested {lastSearchMeta.requested} places, but only {lastSearchMeta.found} match your search criteria. 
                {lastSearchMeta.returned > 0 && ` We've shown you ${lastSearchMeta.returned} places below.`}
              </p>
              <p className="text-amber-700 dark:text-amber-300 mb-4">
                To get more variety in your searches, consider generating additional places from OpenStreetMap. 
                This will expand your database with more local points of interest.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/admin')}
                  className="btn-primary"
                >
                  🏗️ Generate More Places
                </button>
                <button
                  onClick={() => {
                    setShouldGenerateMore(false);
                    setLastSearchMeta(null);
                  }}
                  className="btn-secondary"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {availablePlaces.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Available Places</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {availablePlaces.length} place{availablePlaces.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="space-y-4">
            {availablePlaces.map(renderPlace)}
          </div>
        </div>
      )}

      {searching && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">🔍 Discovering Places</h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="border dark:border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-full"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 ml-4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plannedPlaces.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Planning to Visit</h3>
          <div className="space-y-4">
            {plannedPlaces.map(renderPlace)}
          </div>
        </div>
      )}
    </div>
  );
} 