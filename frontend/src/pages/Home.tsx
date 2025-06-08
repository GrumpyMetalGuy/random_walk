import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Place {
  id: number;
  name: string;
  description: string | null;
  locationType: string;
  distance?: number;
  visitStatus: 'AVAILABLE' | 'PLANNED' | 'VISITED';
}

// Helper function to format category names
function formatCategoryName(category: string): string {
  return category.split('_').map(word => 
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join(' ');
}

export function Home() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number>(5);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const distances = [5, 10, 15, 20, 40];
  const categories = ['TOWN', 'CITY', 'TOURIST_ATTRACTION', 'PARK', 'PLAYGROUND'];

  useEffect(() => {
    // Check if setup is complete
    async function checkSetup() {
      try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        const setupComplete = settings.find((s: any) => s.key === 'setup_complete')?.value === 'true';
        
        if (!setupComplete) {
          navigate('/admin');
          return;
        }

        // Fetch all places
        const placesResponse = await fetch('/api/places');
        const placesData = await placesResponse.json();
        setPlaces(placesData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setError('Failed to load application settings');
        setLoading(false);
      }
    }
    
    checkSetup();
  }, [navigate]);

  const handleGeneratePlaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/places/random', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distance: selectedDistance,
          categories: selectedCategories.length > 0 ? selectedCategories : categories,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch places');
      }
      
      const newPlaces = await response.json();
      if (Array.isArray(newPlaces) && newPlaces.length === 0) {
        setError('No places found within the selected distance and categories. Try increasing the distance or selecting different categories.');
      }
      // Only replace the available places, keep planned and visited places
      setPlaces(places => [
        ...places.filter(p => p.visitStatus !== 'AVAILABLE'),
        ...newPlaces
      ]);
    } catch (error) {
      console.error('Failed to fetch places:', error);
      setError('Failed to find places. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanVisit = async (placeId: number) => {
    try {
      const response = await fetch(`/api/places/${placeId}/plan`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to plan place visit');
      }
      const updatedPlace = await response.json();
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to plan place visit:', error);
    }
  };

  const handleCancelPlan = async (placeId: number) => {
    try {
      const response = await fetch(`/api/places/${placeId}/unplan`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to cancel plan');
      }
      // Remove the place entirely instead of updating its status
      setPlaces(places => places.filter(place => place.id !== placeId));
    } catch (error) {
      console.error('Failed to cancel plan:', error);
    }
  };

  const handleVisit = async (placeId: number) => {
    try {
      const response = await fetch(`/api/places/${placeId}/visit`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark place as visited');
      }
      const updatedPlace = await response.json();
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to mark place as visited:', error);
    }
  };

  const handleUnvisit = async (placeId: number) => {
    try {
      const response = await fetch(`/api/places/${placeId}/unvisit`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to unmark place as visited');
      }
      const updatedPlace = await response.json();
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to unmark place as visited:', error);
    }
  };

  const renderPlace = (place: Place) => (
    <div
      key={place.id}
      className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-lg font-medium">{place.name}</h4>
          {place.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {place.description}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {formatCategoryName(place.locationType)}
            {place.distance !== undefined && ` • ${place.distance.toFixed(1)} miles away`}
          </p>
        </div>
        <div className="flex gap-2">
          {place.visitStatus === 'AVAILABLE' && (
            <button
              onClick={() => handlePlanVisit(place.id)}
              className="btn-primary"
            >
              Plan to Visit
            </button>
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

  const availablePlaces = places.filter(p => p.visitStatus === 'AVAILABLE');
  const plannedPlaces = places.filter(p => p.visitStatus === 'PLANNED');
  const visitedPlaces = places.filter(p => p.visitStatus === 'VISITED');

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Find Places to Visit</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Distance (miles)</label>
            <select
              value={selectedDistance}
              onChange={(e) => setSelectedDistance(Number(e.target.value))}
              className="input-primary"
            >
              {distances.map(distance => (
                <option key={distance} value={distance}>
                  Within {distance} miles
                </option>
              ))}
            </select>
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

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleGeneratePlaces}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Finding places...' : 'Find me somewhere to visit'}
          </button>
        </div>
      </div>

      {availablePlaces.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Available Places</h3>
          <div className="space-y-4">
            {availablePlaces.map(renderPlace)}
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

      {visitedPlaces.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Places You've Visited</h3>
          <div className="space-y-4">
            {visitedPlaces.map(renderPlace)}
          </div>
        </div>
      )}
    </div>
  );
} 