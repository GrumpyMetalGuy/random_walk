import { useState } from 'react';
import axios from 'axios';


interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [adminData, setAdminData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [address, setAddress] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'miles' | 'kilometers'>('miles');
  const [searchRanges, setSearchRanges] = useState<number[]>([5, 10, 15, 20, 40]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  // Place generation state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generationStats, setGenerationStats] = useState<any>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminData.password !== adminData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (adminData.password.length < 20) {
      setError('Password must be at least 20 characters long');
      return;
    }

    if (adminData.username.trim()) {
      setStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      setError(null);
      setStep(3);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage('Creating admin account...');

    try {
      // Step 1: Create admin user with distance unit preference
      await axios.post(`/api/auth/setup`, {
        username: adminData.username,
        password: adminData.password,
        distanceUnit
      });

      setLoadingMessage('Logging in...');
      
      // Step 2: Automatically log in the admin user to get a token
      const loginResponse = await axios.post(`/api/auth/login`, {
        username: adminData.username,
        password: adminData.password,
        rememberMe: true
      });

      if (loginResponse.data.success && loginResponse.data.token) {
        // Store token for place generation
        localStorage.setItem('token', loginResponse.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${loginResponse.data.token}`;
      }

      setLoadingMessage('Geocoding your home address...');
      
      // Step 3: Save the home address (this might take time due to geocoding)
      await axios.put(`/api/settings`, {
        key: 'home_address',
        value: address,
      });

      setLoadingMessage('Saving distance preferences...');
      
      // Step 4: Save the search ranges
      const sortedRanges = [...searchRanges].sort((a, b) => a - b);
      await axios.put(`/api/settings`, {
        key: 'search_ranges',
        value: JSON.stringify(sortedRanges),
      });

      setLoadingMessage('');
      
      // Go to step 4 for place generation
      setStep(4);
    } catch (error) {
      console.error('Failed to complete setup:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to complete setup. Please try again.');
      }
      setLoadingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlaces = async () => {
    setGenerating(true);
    setError(null);
    setGenerationProgress('');
    setGenerationStats(null);

    try {
      // Get the token from localStorage (should be set after admin creation)
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/places/generate-comprehensive`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please try refreshing the page.');
        }
        const errorText = await response.text();
        console.log('Error response:', errorText);
        throw new Error('Failed to start place generation');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setGenerationProgress(data.message);
              } else if (data.type === 'complete') {
                setGenerationStats(data.stats);
                setGenerationProgress('');
                
                // Mark setup as complete
                await axios.put(`/api/settings`, {
                  key: 'setup_complete',
                  value: 'true',
                });
                
                setSetupComplete(true);
              } else if (data.type === 'error') {
                setError(data.message);
                setGenerationProgress('');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate places:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate places. You can skip this step and generate places later from the Admin page.');
      setGenerationProgress('');
    } finally {
      setGenerating(false);
    }
  };

  const handleSkipGeneration = async () => {
    try {
      // Mark setup as complete even without place generation
      await axios.put(`/api/settings`, {
        key: 'setup_complete',
        value: 'true',
      });
      
      onComplete();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      setError('Failed to complete setup. Please try again.');
    }
  };

  const handleCompleteSetup = () => {
    onComplete();
  };

  const handleAdminDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addRange = () => {
    setSearchRanges([...searchRanges, 25]);
  };

  const removeRange = (index: number) => {
    if (searchRanges.length > 1) {
      setSearchRanges(searchRanges.filter((_, i) => i !== index));
    }
  };

  const updateRange = (index: number, value: number) => {
    const newRanges = [...searchRanges];
    newRanges[index] = value;
    setSearchRanges(newRanges); // Don't sort while editing
  };

  const sortRanges = () => {
    setSearchRanges([...searchRanges].sort((a, b) => a - b));
  };

  const getUnitLabel = () => distanceUnit === 'miles' ? 'mi' : 'km';
  const getUnitName = () => distanceUnit === 'miles' ? 'miles' : 'kilometers';

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Create your admin account";
      case 2: return "Set up your home location";
      case 3: return "Configure distance preferences";
      case 4: return "Generate initial places";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Welcome to Random Walk
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {getStepTitle()}
          </p>
          <div className="mt-4 flex justify-center">
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step >= 4 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={handleStep1Submit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Admin Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={adminData.username}
                  onChange={handleAdminDataChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                  placeholder="Choose an admin username"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={adminData.password}
                  onChange={handleAdminDataChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                  placeholder="Enter a secure password (min 20 characters)"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Password must be at least 20 characters long. Use a password manager for best security.
                </p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={adminData.confirmPassword}
                  onChange={handleAdminDataChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">You're creating the first admin account</p>
                <p className="mt-1">This account will have full access to manage users and settings.</p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={!adminData.username.trim() || adminData.password.length < 20 || adminData.password !== adminData.confirmPassword}
                className="btn-primary w-full"
              >
                Next: Set Home Location
              </button>
            </div>
          </form>
        ) : step === 2 ? (
          <form className="mt-8 space-y-6" onSubmit={handleStep2Submit}>
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Home Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  className="input-primary rounded-md"
                  placeholder="Enter your home address (e.g., London, UK)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This will be used as the center point for finding places around you.
                </p>
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!address.trim()}
                className="btn-primary flex-1"
              >
                Next: Configure Distances
              </button>
            </div>
          </form>
        ) : step === 3 ? (
          <form className="mt-8 space-y-6" onSubmit={handleFinalSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="distanceUnit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Distance Unit Preference
                </label>
                <select
                  id="distanceUnit"
                  name="distanceUnit"
                  required
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value as 'miles' | 'kilometers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="miles">Miles</option>
                  <option value="kilometers">Kilometers</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choose how distances will be displayed throughout the application.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Distance Ranges ({getUnitName()})
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  These are the distance bands from your home where we'll search for places. 
                  More bands = more comprehensive coverage but longer initial setup time.
                </p>
                
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Distance Ranges</span>
                    <button
                      type="button"
                      onClick={addRange}
                      className="btn-secondary text-sm"
                    >
                      Add Range
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {searchRanges.map((range, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={range}
                          onChange={(e) => updateRange(index, parseInt(e.target.value) || 1)}
                          onBlur={sortRanges}
                          className="input-primary w-16 text-sm"
                        />
                        <span className="text-xs text-gray-500">{getUnitLabel()}</span>
                        {searchRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRange(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {loading && loadingMessage && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">{loadingMessage}</p>
                  {loadingMessage.includes('Geocoding') && (
                    <p className="mt-1 text-xs">This may take a moment as we look up your address coordinates...</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? (loadingMessage || 'Saving Settings...') : 'Next: Generate Places'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Generate Initial Places
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                We'll now search for interesting places around your location. This may take a few minutes 
                as we comprehensively scan OpenStreetMap data within your configured distance ranges.
              </p>
            </div>

            {!setupComplete && !generating && !generationStats && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">What happens during place generation:</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>Search for parks, attractions, towns, and other interesting places</li>
                      <li>Filter by your configured distance ranges ({searchRanges.join(', ')} {getUnitName()})</li>
                      <li>Remove duplicates and enhance with additional details</li>
                      <li>Save everything to your local database</li>
                    </ul>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleGeneratePlaces}
                    disabled={generating}
                    className="btn-primary flex-1"
                  >
                    Generate Places
                  </button>
                </div>
                
                <div className="text-center">
                  <button
                    onClick={handleSkipGeneration}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    Skip for now (you can generate places later from the Admin page)
                  </button>
                </div>
              </div>
            )}

            {generating && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">Generating places...</p>
                    <p className="mt-1">This process searches OpenStreetMap for interesting places around your location.</p>
                  </div>
                </div>
                
                {generationProgress && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {generationProgress}
                    </div>
                  </div>
                )}
              </div>
            )}

            {setupComplete && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-medium">🎉 Setup Complete!</p>
                    {generationStats && (
                      <p className="mt-1">
                        Found {generationStats.total} places, added {generationStats.new} new places to your database.
                      </p>
                    )}
                    <p className="mt-1">You're ready to start discovering places around you!</p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleCompleteSetup}
                    className="btn-primary w-full"
                  >
                    Start Using Random Walk
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={handleGeneratePlaces}
                    disabled={generating}
                    className="btn-secondary text-sm"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleSkipGeneration}
                    className="btn-primary text-sm"
                  >
                    Skip and Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 