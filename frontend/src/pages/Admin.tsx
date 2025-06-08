import { useState, useEffect } from 'react';
import { SetupWizard } from '../components/SetupWizard';
import { useAuth, User } from '../contexts/AuthContext';

interface Place {
  id: number;
  name: string;
  description: string | null;
  locationType: string;
  visitStatus: 'AVAILABLE' | 'PLANNED' | 'VISITED';
}

interface Setting {
  key: string;
  value: string;
}

interface DataSummary {
  places: number;
  settings: number;
  users: number;
  totalRecords: number;
}

// Default place counts (matching backend)
const defaultPlaceCounts = {
  PARK: 300,
  TOURIST_ATTRACTION: 100,
  TOWN: 75,
  CITY: 30,
  PLAYGROUND: 150
};

const placeTypeLabels = {
  PARK: 'Parks',
  TOURIST_ATTRACTION: 'Tourist Attractions',
  TOWN: 'Towns',
  CITY: 'Cities',
  PLAYGROUND: 'Playgrounds'
};

export function Admin() {
  const { register } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // User management state
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'USER' as 'USER' | 'ADMIN'
  });

  const fetchData = async () => {
    try {
      const [placesRes, settingsRes, summaryRes] = await Promise.all([
        fetch('/api/places'),
        fetch('/api/settings'),
        fetch('/api/admin/data/summary')
      ]);
      const [placesData, settingsData, summaryData] = await Promise.all([
        placesRes.json(),
        settingsRes.json(),
        summaryRes.json()
      ]);
      setPlaces(placesData);
      setSettings(settingsData);
      if (summaryData.success) {
        setDataSummary(summaryData.summary);
      }
      
      const setupSetting = settingsData.find((s: Setting) => s.key === 'setup_complete');
      setSetupComplete(setupSetting?.value === 'true');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUnmarkVisited = async (placeId: number) => {
    try {
      await fetch(`/api/places/${placeId}/unvisit`, {
        method: 'POST',
      });
      setPlaces(places.map(place => 
        place.id === placeId ? { ...place, visitStatus: 'AVAILABLE' } : place
      ));
    } catch (error) {
      console.error('Failed to unmark place as visited:', error);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to update setting');
        return;
      }

      const setting = await response.json();
      setSettings(settings.map(s => 
        s.key === key ? setting : s
      ));
      setError(null);
    } catch (error) {
      console.error('Failed to update setting:', error);
      setError('Failed to update setting. Please try again.');
    }
  };

  const handleGenerateMorePlaces = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/places/generate', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to generate places');
      }
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to generate more places:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newUser.password !== newUser.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newUser.password.length < 20) {
      setError('Password must be at least 20 characters long');
      return;
    }

    try {
      await register(newUser.username, newUser.password, newUser.role);
      setSuccessMessage(`User ${newUser.username} created successfully`);
      setNewUser({ username: '', password: '', confirmPassword: '', role: 'USER' });
      setShowUserForm(false);
      await fetchData(); // Refresh data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/admin/data/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `random-walk-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccessMessage('Data exported successfully');
    } catch (error) {
      setError('Failed to export data');
    }
  };

  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure? This will delete ALL data including users, places, and settings. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/data/all', {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage('All data deleted successfully');
        await fetchData();
      } else {
        setError(data.error || 'Failed to delete data');
      }
    } catch (error) {
      setError('Failed to delete data');
    }
  };

  const getPlaceCountSetting = (type: string): number => {
    const setting = settings.find(s => s.key === `place_count_${type.toLowerCase()}`);
    return setting ? parseInt(setting.value) : defaultPlaceCounts[type as keyof typeof defaultPlaceCounts];
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (setupComplete === false) {
    return <SetupWizard onComplete={fetchData} />;
  }

  const homeAddress = settings.find(s => s.key === 'home_address')?.value;
  const unvisitedCount = places.filter(p => p.visitStatus === 'AVAILABLE').length;

  return (
    <div className="space-y-8">
      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
        </div>
      )}
      {successMessage && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
          <div className="text-sm text-green-800 dark:text-green-200">{successMessage}</div>
        </div>
      )}

      {/* Data Summary */}
      {dataSummary && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Data Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dataSummary.users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{dataSummary.places}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Places</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{dataSummary.settings}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Settings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">{dataSummary.totalRecords}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Records</div>
            </div>
          </div>
        </div>
      )}

      {/* User Management */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">User Management</h2>
          <button
            onClick={() => setShowUserForm(!showUserForm)}
            className="btn-primary"
          >
            {showUserForm ? 'Cancel' : 'Add New User'}
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="input-primary w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'USER' | 'ADMIN' })}
                  className="input-primary w-full"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password (min 20 chars)</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input-primary w-full"
                  required
                  minLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                  className="input-primary w-full"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create User
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Data Management</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 border dark:border-gray-700 rounded-lg">
            <div>
              <h3 className="font-medium">Export All Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Download a complete backup of all application data</p>
            </div>
            <button onClick={handleExportData} className="btn-primary">
              Export Data
            </button>
          </div>
          
          <div className="flex justify-between items-center p-4 border dark:border-gray-700 rounded-lg bg-red-50 dark:bg-red-900/10">
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Delete All Data</h3>
              <p className="text-sm text-red-600 dark:text-red-300">Permanently delete all users, places, and settings</p>
            </div>
            <button onClick={handleDeleteAllData} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md">
              Delete All Data
            </button>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <label className="block text-sm font-medium flex-1">
              Home Address
            </label>
            <input
              type="text"
              value={homeAddress || ''}
              onChange={(e) => handleUpdateSetting('home_address', e.target.value)}
              className="input-primary max-w-xs"
              placeholder="Enter your home address"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Place Generation Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure how many places of each type should be generated around your location.
            </p>
            {Object.entries(placeTypeLabels).map(([type, label]) => (
              <div key={type} className="flex items-center space-x-4">
                <label className="block text-sm font-medium flex-1">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={getPlaceCountSetting(type)}
                  onChange={(e) => handleUpdateSetting(`place_count_${type.toLowerCase()}`, e.target.value)}
                  className="input-primary w-24"
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Generate More Places</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Currently {unvisitedCount} unvisited places available.
                </p>
              </div>
              <button
                onClick={handleGenerateMorePlaces}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? 'Generating...' : 'Generate More Places'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visited Places */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Visited Places</h2>
        <div className="space-y-4">
          {places.filter(place => place.visitStatus === 'VISITED').map(place => (
            <div
              key={place.id}
              className="border dark:border-gray-700 rounded-lg p-4"
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
                    {place.locationType.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={() => handleUnmarkVisited(place.id)}
                  className="btn-secondary"
                >
                  Unmark as Visited
                </button>
              </div>
            </div>
          ))}
          {places.filter(place => place.visitStatus === 'VISITED').length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No visited places yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 