import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { parseDescription, formatCategoryName, generateOSMLink, formatDate } from '../utils';
import axios from 'axios';


interface Place {
  id: number;
  name: string;
  description: string | null;
  locationType: string;
  visitStatus: 'AVAILABLE' | 'PLANNED' | 'VISITED' | 'IGNORED';
  osmId?: string | null;
  latitude: number;
  longitude: number;
  lastVisited?: string | null;
  lastIgnored?: string | null;
}

export function Places() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/places`);
      setPlaces(response.data);
    } catch (error) {
      console.error('Failed to fetch places:', error);
      setError('Failed to load places');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmarkVisited = async (placeId: number) => {
    try {
      const response = await axios.post(`/api/places/${placeId}/unvisit`);
      const updatedPlace = response.data;
      setPlaces(places.map(place => 
        place.id === placeId ? updatedPlace : place
      ));
    } catch (error) {
      console.error('Failed to unmark visited place:', error);
    }
  };

  const handleUnignore = async (placeId: number) => {
    try {
      await axios.post(`/api/places/${placeId}/unignore`);
      // Remove from the list since it goes back to AVAILABLE
      setPlaces(places => places.filter(place => place.id !== placeId));
    } catch (error) {
      console.error('Failed to unignore place:', error);
    }
  };

  const visitedPlaces = places.filter(place => place.visitStatus === 'VISITED');
  const ignoredPlaces = places.filter(place => place.visitStatus === 'IGNORED');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        </div>
      )}

      {/* Visited Places */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Visited Places</h2>
        <div className="space-y-4">
          {visitedPlaces.map(place => (
            <div
              key={place.id}
              className="border dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-medium">{place.name}</h4>
                  {place.description && (
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {parseDescription(place.description || '').parts.map((part, index) => (
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
                          {index < parseDescription(place.description || '').parts.length - 1 && ' • '}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {formatCategoryName(place.locationType)}
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
                    {place.lastVisited && (
                      <span className="text-green-600 dark:text-green-400">
                        {' • '}Visited {formatDate(place.lastVisited)}
                      </span>
                    )}
                  </p>
                </div>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => handleUnmarkVisited(place.id)}
                    className="btn-secondary"
                  >
                    Unmark as Visited
                  </button>
                )}
              </div>
            </div>
          ))}
          {visitedPlaces.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No visited places yet
            </p>
          )}
        </div>
      </div>

      {/* Ignored Places */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Ignored Places</h2>
        <div className="space-y-4">
          {ignoredPlaces.map(place => (
            <div
              key={place.id}
              className="border dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-medium">{place.name}</h4>
                  {place.description && (
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {parseDescription(place.description || '').parts.map((part, index) => (
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
                          {index < parseDescription(place.description || '').parts.length - 1 && ' • '}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {formatCategoryName(place.locationType)}
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
                    {place.lastIgnored && (
                      <span className="text-orange-600 dark:text-orange-400">
                        {' • '}Ignored {formatDate(place.lastIgnored)}
                      </span>
                    )}
                  </p>
                </div>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => handleUnignore(place.id)}
                    className="btn-secondary"
                  >
                    Unignore
                  </button>
                )}
              </div>
            </div>
          ))}
          {ignoredPlaces.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No ignored places
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 