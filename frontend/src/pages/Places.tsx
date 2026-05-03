import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { parseDescription, extractAddress, formatCategoryName, generateOSMLink, formatDate } from '../utils';
import { AddressLink } from '../components/AddressLink';
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
  notes?: string | null;
}

export function Places() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const startEditNotes = (place: Place) => {
    setEditingNotesId(place.id);
    setNotesDraft(place.notes ?? '');
  };

  const cancelEditNotes = () => {
    setEditingNotesId(null);
    setNotesDraft('');
  };

  const saveNotes = async (placeId: number) => {
    setSavingNotes(true);
    try {
      const response = await axios.patch(`/api/places/${placeId}`, {
        notes: notesDraft,
      });
      const updated = response.data;
      setPlaces(places.map(p => (p.id === placeId ? { ...p, notes: updated.notes ?? null } : p)));
      setEditingNotesId(null);
      setNotesDraft('');
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError('Failed to save notes. Please try again.');
    } finally {
      setSavingNotes(false);
    }
  };

  const renderPlaceBody = (place: Place) => {
    const parsed = parseDescription(place.description || '');
    const visibleParts = parsed.parts.filter(p => !p.content.startsWith('📍 '));
    const address = extractAddress(place.description) ?? `${place.latitude}, ${place.longitude}`;
    const osmLink = generateOSMLink(place);
    return (
      <>
        {visibleParts.length > 0 && (
          <div className="text-gray-600 dark:text-gray-400 mt-1">
            {visibleParts.map((part, index) => (
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
                {index < visibleParts.length - 1 && ' • '}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {formatCategoryName(place.locationType)}
          {' • '}
          <AddressLink address={address} />
          {osmLink && (
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
          )}
          {place.lastVisited && place.visitStatus === 'VISITED' && (
            <span className="text-green-600 dark:text-green-400">
              {' • '}Visited {formatDate(place.lastVisited)}
            </span>
          )}
          {place.lastIgnored && place.visitStatus === 'IGNORED' && (
            <span className="text-orange-600 dark:text-orange-400">
              {' • '}Ignored {formatDate(place.lastIgnored)}
            </span>
          )}
        </p>
      </>
    );
  };

  const renderNotesBlock = (place: Place) => {
    const isEditing = editingNotesId === place.id;
    if (isEditing) {
      return (
        <div className="mt-3 space-y-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Add notes for this place..."
            className="input-primary w-full"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => saveNotes(place.id)}
              disabled={savingNotes}
              className="btn-primary text-sm"
            >
              {savingNotes ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelEditNotes}
              disabled={savingNotes}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        {place.notes ? (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 rounded p-2">
            {place.notes}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No notes yet.</p>
        )}
        <button
          onClick={() => startEditNotes(place)}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {place.notes ? 'Edit notes' : 'Add notes'}
        </button>
      </div>
    );
  };

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
                  {renderPlaceBody(place)}
                  {renderNotesBlock(place)}
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
                  {renderPlaceBody(place)}
                  {renderNotesBlock(place)}
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