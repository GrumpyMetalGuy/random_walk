import React, { useState, useEffect } from 'react';
import { SetupWizard } from '../components/SetupWizard';
import { useAuth } from '../contexts/AuthContext';
// import { parseDescription, formatCategoryName } from '../utils';
import axios from 'axios';


interface Place {
  id: number;
  name: string;
  description: string | null;
  locationType: string;
  visitStatus: 'AVAILABLE' | 'PLANNED' | 'VISITED' | 'IGNORED';
}

interface Setting {
  key: string;
  value: string;
}

interface DataSummary {
  places: number;
  users: number;
  categoryCounts: { [key: string]: number };
}

interface AdminUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  lastLoginAt: string | null;
}

interface CategoryConfig {
  type: string;
  filters: string[];
  enabled: boolean;
}



const placeTypeLabels = {
  PARK: 'Parks',
  TOURIST_ATTRACTION: 'Tourist Attractions',
  TOWN: 'Towns',
  CITY: 'Cities',
  PLAYGROUND: 'Playgrounds'
};

// CategoryForm component
function CategoryForm({ 
  category, 
  onSave, 
  onCancel 
}: { 
  category: CategoryConfig | null; 
  onSave: (category: CategoryConfig) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState<CategoryConfig>(
    category || { type: '', filters: [''], enabled: true }
  );

  useEffect(() => {
    if (category) {
      setFormData(category);
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type.trim()) {
      alert('Category type is required');
      return;
    }
    
    const validFilters = formData.filters.filter(f => f.trim());
    if (validFilters.length === 0) {
      alert('At least one filter is required');
      return;
    }

    onSave({
      ...formData,
      type: formData.type.toUpperCase().replace(/\s+/g, '_'),
      filters: validFilters
    });
  };

  const addFilter = () => {
    setFormData({
      ...formData,
      filters: [...formData.filters, '']
    });
  };

  const removeFilter = (index: number) => {
    setFormData({
      ...formData,
      filters: formData.filters.filter((_, i) => i !== index)
    });
  };

  const updateFilter = (index: number, value: string) => {
    const newFilters = [...formData.filters];
    newFilters[index] = value;
    setFormData({
      ...formData,
      filters: newFilters
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category Type</label>
          <input
            type="text"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            placeholder="e.g., RESTAURANT, SCHOOL"
            className="input-primary w-full"
            required
          />
        </div>
        <div className="flex items-center">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">OpenStreetMap Filters</label>
          <button type="button" onClick={addFilter} className="btn-secondary text-sm">
            Add Filter
          </button>
        </div>
        <div className="space-y-2">
          {formData.filters.map((filter, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => updateFilter(index, e.target.value)}
                placeholder="e.g., amenity=restaurant, leisure=park"
                className="input-primary flex-1 font-mono text-sm"
              />
              {formData.filters.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFilter(index)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Use OpenStreetMap tag syntax. Examples: amenity=restaurant, leisure=park, tourism=attraction
        </p>
      </div>

      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {category ? 'Update Category' : 'Add Category'}
        </button>
      </div>
    </form>
  );
}

export function Admin() {
  const { register, logout } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'USER' as 'USER' | 'ADMIN'
  });

  // Category configuration state
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null);

  // Range configuration state
  const [searchRanges, setSearchRanges] = useState<number[]>([5, 10, 15, 20, 40]); // Default ranges in miles
  const [editingRanges, setEditingRanges] = useState(false);

  // Generation progress state
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generationStats, setGenerationStats] = useState<{total: number, new: number, duplicates: number} | null>(null);

  // Advanced settings state
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Rate limiting state
  const [nominatimVariationMs, setNominatimVariationMs] = useState<number>(500); // Default 0.5s variation
  const [editingRateLimit, setEditingRateLimit] = useState(false);

  // Helper function to handle authentication errors
  const handleAuthError = async (error: any) => {
    if (error?.response?.status === 401 || error?.status === 401) {
      console.log('Authentication failed, logging out user');
      await logout();
      setError('Your session has expired. Please log in again.');
      return true;
    }
    return false;
  };

  const fetchData = async () => {
    try {
      const [placesRes, settingsRes, summaryRes, categoriesRes, usersRes] = await Promise.all([
        axios.get(`/api/places`),
        axios.get(`/api/settings`),
        axios.get(`/api/admin/data/summary`),
        axios.get(`/api/categories`),
        axios.get(`/api/auth/users`)
      ]);
      const [placesData, settingsData, summaryData, categoriesData, usersData] = await Promise.all([
        placesRes.data,
        settingsRes.data,
        summaryRes.data,
        categoriesRes.data,
        usersRes.data
      ]);
      setPlaces(placesData);
      setSettings(settingsData);
      if (summaryData.success) {
        setDataSummary(summaryData.summary);
      }
      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }
      if (usersData.success) {
        setUsers(usersData.users);
      }
      
      // Load search ranges from settings
      const rangesSetting = settingsData.find((s: Setting) => s.key === 'search_ranges');
      if (rangesSetting?.value) {
        try {
          const ranges = JSON.parse(rangesSetting.value);
          if (Array.isArray(ranges) && ranges.every(r => typeof r === 'number')) {
            setSearchRanges(ranges);
          }
        } catch (error) {
          console.error('Failed to parse search ranges:', error);
        }
      }
      
      // Load Nominatim rate limiting variation from settings
      const rateLimitSetting = settingsData.find((s: Setting) => s.key === 'nominatim_rate_variation_ms');
      if (rateLimitSetting?.value) {
        const variation = parseInt(rateLimitSetting.value);
        if (!isNaN(variation) && variation >= 0 && variation <= 5000) {
          setNominatimVariationMs(variation);
        }
      }
      
      const setupSetting = settingsData.find((s: Setting) => s.key === 'setup_complete');
      setSetupComplete(setupSetting?.value === 'true');
    } catch (error) {
      console.error('Failed to fetch data:', error);
      const handled = await handleAuthError(error);
      if (!handled) {
        setError('Failed to load data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const response = await axios.put(`/api/settings`, { key, value });
      const setting = response.data;
      setSettings(settings.map(s => 
        s.key === key ? setting : s
      ));
      setError(null);
    } catch (error) {
      console.error('Failed to update setting:', error);
      const handled = await handleAuthError(error);
      if (!handled) {
        setError('Failed to update setting. Please try again.');
      }
    }
  };

  const handleGenerateMorePlaces = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    setGenerationProgress('');
    setGenerationStats(null);

    try {
      // Get the token from localStorage to include in headers
      const token = localStorage.getItem('token');
      console.log('Token found:', !!token);
      
      // First, test basic connectivity with a simple API call
      console.log('Testing connectivity...');
      try {
        const testResponse = await axios.get(`/api/auth/me`);
        console.log('Connectivity test passed:', testResponse.status);
      } catch (connectError) {
        console.error('Connectivity test failed:', connectError);
        if (axios.isAxiosError(connectError) && connectError.response?.status === 401) {
          console.log('Authentication failed during connectivity test, logging out');
          await logout();
          throw new Error('Your session has expired. Please log in again.');
        }
        throw new Error('Network connectivity issue. Please check your connection.');
      }
      
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Making request to:', `/api/places/generate-comprehensive`);
      console.log('Headers:', headers);

      const response = await fetch(`/api/places/generate-comprehensive`, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Authentication failed, logging out user');
          await logout();
          throw new Error('Your session has expired. Please log in again.');
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
                setSuccessMessage(data.message);
                setGenerationStats(data.stats);
                setGenerationProgress('');
                // Refresh the data to show new places
                await fetchData();
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
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setError(error instanceof Error ? error.message : 'Failed to generate places. Please try again.');
      setGenerationProgress('');
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

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewUser({
      username: user.username,
      password: '',
      confirmPassword: '',
      role: user.role
    });
    setShowUserForm(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setError(null);
    setSuccessMessage(null);

    if (newUser.password && newUser.password !== newUser.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newUser.password && newUser.password.length < 20) {
      setError('Password must be at least 20 characters long');
      return;
    }

    try {
      const updateData: any = {
        username: newUser.username,
        role: newUser.role
      };

      if (newUser.password) {
        updateData.password = newUser.password;
      }

      await axios.put(`/api/auth/users/${editingUser.id}`, updateData);
      setSuccessMessage(`User ${newUser.username} updated successfully`);
      setNewUser({ username: '', password: '', confirmPassword: '', role: 'USER' });
      setEditingUser(null);
      setShowUserForm(false);
      await fetchData(); // Refresh data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError(error instanceof Error ? error.message : 'Failed to update user');
      }
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete user ${user.username}?`)) {
      return;
    }

    try {
      await axios.delete(`/api/auth/users/${user.id}`);
      setSuccessMessage(`User ${user.username} deleted successfully`);
      await fetchData(); // Refresh data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError(error instanceof Error ? error.message : 'Failed to delete user');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUser({ username: '', password: '', confirmPassword: '', role: 'USER' });
    setShowUserForm(false);
  };

  const handleExportData = async () => {
    try {
      const response = await axios.get(`/api/admin/data/export`, { responseType: 'blob' });
      const blob = response.data;
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
      const response = await axios.delete(`/api/admin/data/all`);
      const data = response.data;
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

  const handleToggleCategory = async (type: string, enabled: boolean) => {
    try {
      await axios.patch(`/api/categories/${type}/toggle`, { enabled });
      setCategories(categories.map(cat => 
        cat.type === type ? { ...cat, enabled } : cat
      ));
      setSuccessMessage(`Category ${type} ${enabled ? 'enabled' : 'disabled'} successfully`);
      setError(null);
    } catch (error) {
      setError('Failed to toggle category');
    }
  };

  const handleSaveCategory = async (category: CategoryConfig) => {
    try {
      if (editingCategory) {
        // Update existing category
        const updatedCategories = categories.map(cat => 
          cat.type === editingCategory.type ? category : cat
        );
        await axios.put(`/api/categories`, updatedCategories);
        setCategories(updatedCategories);
        setSuccessMessage('Category updated successfully');
      } else {
        // Add new category
        await axios.post(`/api/categories`, category);
        setCategories([...categories, category]);
        setSuccessMessage('Category added successfully');
      }
      setEditingCategory(null);
      setShowCategoryForm(false);
      setError(null);
    } catch (error) {
      setError('Failed to save category');
    }
  };

  const handleDeleteCategory = async (type: string) => {
    if (!confirm(`Are you sure you want to delete the ${type} category?`)) {
      return;
    }

    try {
      await axios.delete(`/api/categories/${type}`);
      setCategories(categories.filter(cat => cat.type !== type));
      setSuccessMessage('Category deleted successfully');
      setError(null);
    } catch (error) {
      setError('Failed to delete category');
    }
  };

  const handleSaveRanges = async () => {
    try {
      const sortedRanges = [...searchRanges].sort((a, b) => a - b);
      await axios.put(`/api/settings`, { 
        key: 'search_ranges', 
        value: JSON.stringify(sortedRanges) 
      });
      setSearchRanges(sortedRanges); // Update state with sorted ranges
      setSuccessMessage('Search ranges updated successfully');
      setEditingRanges(false);
      setError(null);
    } catch (error) {
      setError('Failed to update search ranges');
    }
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

  const handleSaveRateLimit = async () => {
    try {
      // Validate the variation (0-5000ms)
      const clampedVariation = Math.max(0, Math.min(5000, nominatimVariationMs));
      
      await handleUpdateSetting('nominatim_rate_variation_ms', clampedVariation.toString());
      setNominatimVariationMs(clampedVariation);
      setEditingRateLimit(false);
      setSuccessMessage(`Nominatim rate limiting updated: 1.1s to ${(1.1 + clampedVariation/1000).toFixed(1)}s range`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save rate limit setting:', error);
      setError('Failed to save rate limit setting. Please try again.');
    }
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dataSummary.users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{dataSummary.places}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Places</div>
            </div>
            {Object.entries(dataSummary.categoryCounts).map(([category, count]) => {
              const label = placeTypeLabels[category as keyof typeof placeTypeLabels] || category;
              const colors = {
                PARK: 'text-emerald-600 dark:text-emerald-400',
                TOURIST_ATTRACTION: 'text-purple-600 dark:text-purple-400',
                TOWN: 'text-amber-600 dark:text-amber-400',
                CITY: 'text-red-600 dark:text-red-400',
                PLAYGROUND: 'text-pink-600 dark:text-pink-400'
              };
              const colorClass = colors[category as keyof typeof colors] || 'text-gray-600 dark:text-gray-400';
              
              return (
                <div key={category} className="text-center">
                  <div className={`text-3xl font-bold ${colorClass}`}>{count}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Management */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">User Management</h2>
          <button
            onClick={() => {
              if (showUserForm && editingUser) {
                handleCancelEdit();
              } else {
                setShowUserForm(!showUserForm);
              }
            }}
            className="btn-primary"
          >
            {showUserForm ? 'Cancel' : 'Add New User'}
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Create New User'}</h3>
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
                <label className="block text-sm font-medium mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password (min 20 chars)'}
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input-primary w-full"
                  required={!editingUser}
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
                  required={!editingUser || newUser.password.length > 0}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={editingUser ? handleCancelEdit : () => setShowUserForm(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        )}

        {/* Users List */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'ADMIN' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No users found
            </div>
          )}
        </div>
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

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium">Distance & Search Configuration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure your distance unit preference and search ranges for finding places.
                  </p>
                </div>
                <button
                  onClick={() => setEditingRanges(!editingRanges)}
                  className="btn-secondary"
                >
                  {editingRanges ? 'Cancel' : 'Edit Configuration'}
                </button>
              </div>

              {/* Distance Unit Preference */}
              <div className="flex items-center space-x-4 mb-4">
                <label className="block text-sm font-medium flex-1">
                  Distance Unit Preference
                </label>
                <select
                  value={settings.find(s => s.key === 'distance_unit')?.value || 'miles'}
                  onChange={(e) => handleUpdateSetting('distance_unit', e.target.value)}
                  className="input-primary max-w-xs"
                >
                  <option value="miles">Miles</option>
                  <option value="kilometers">Kilometers</option>
                </select>
              </div>
              
              {editingRanges ? (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Distance Ranges (miles)</span>
                    <button
                      onClick={addRange}
                      className="btn-secondary text-sm"
                    >
                      Add Range
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
                        <span className="text-xs text-gray-500">mi</span>
                        {searchRanges.length > 1 && (
                          <button
                            onClick={() => removeRange(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setEditingRanges(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRanges}
                      className="btn-primary text-sm"
                    >
                      Save Ranges
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current search ranges:</p>
                  <div className="flex flex-wrap gap-2">
                    {searchRanges.map((range, index) => (
                      <span key={index} className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm">
                        {range} miles
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Get Updated Places</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Currently {unvisitedCount} unvisited places available.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Comprehensive search will find ALL places within your configured ranges.
                </p>
              </div>
              <button
                onClick={handleGenerateMorePlaces}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? 'Getting Places...' : 'Get Updated Places'}
              </button>
            </div>
            
            {/* Progress Display */}
            {generating && generationProgress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">{generationProgress}</p>
                </div>
              </div>
            )}
            
            {/* Generation Stats */}
            {generationStats && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">{generationStats.total}</div>
                    <div className="text-sm text-green-600 dark:text-green-400">Total Found</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">{generationStats.new}</div>
                    <div className="text-sm text-green-600 dark:text-green-400">New Places</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">{generationStats.duplicates}</div>
                    <div className="text-sm text-green-600 dark:text-green-400">Already Known</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Advanced Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure advanced place search parameters and OpenStreetMap filters.
            </p>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn-secondary"
          >
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-6 pt-6 border-t dark:border-gray-700">
            {/* Place Search Configuration */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold">Place Search Configuration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure the OpenStreetMap terms used to find different types of places.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setShowCategoryForm(!showCategoryForm);
                  }}
                  className="btn-primary"
                >
                  {showCategoryForm ? 'Cancel' : 'Add Category'}
                </button>
              </div>

        {showCategoryForm && (
          <CategoryForm
            category={editingCategory}
            onSave={handleSaveCategory}
            onCancel={() => {
              setShowCategoryForm(false);
              setEditingCategory(null);
            }}
          />
        )}

        <div className="space-y-4">
          {categories.map((category) => (
            <div
              key={category.type}
              className={`border dark:border-gray-700 rounded-lg p-4 ${
                !category.enabled ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-medium">{category.type.replace('_', ' ')}</h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={category.enabled}
                      onChange={(e) => handleToggleCategory(category.type, e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Enabled</span>
                  </label>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setShowCategoryForm(true);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.type)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Search filters:</strong>
                <div className="mt-1 flex flex-wrap gap-1">
                  {category.filters.map((filter, index) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No search categories configured
            </p>
          )}
        </div>
            </div>

            {/* Nominatim Rate Limiting Configuration */}
            <div className="mb-6 pt-6 border-t dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold">Nominatim API Rate Limiting</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure random timing variation for Nominatim geocoding requests to avoid detection patterns.
                  </p>
                </div>
                <button
                  onClick={() => setEditingRateLimit(!editingRateLimit)}
                  className="btn-secondary"
                >
                  {editingRateLimit ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editingRateLimit ? (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Maximum Variation (milliseconds)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="5000"
                        step="100"
                        value={nominatimVariationMs}
                        onChange={(e) => setNominatimVariationMs(parseInt(e.target.value) || 0)}
                        className="input-primary w-32"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Range: 0-5000ms (0-5 seconds)
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Current timing:</strong> Random delay between{' '}
                        <span className="font-mono">1.1s</span> and{' '}
                        <span className="font-mono">{(1.1 + nominatimVariationMs/1000).toFixed(1)}s</span>
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        This prevents predictable request patterns while respecting Nominatim's 1-request-per-second limit.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      onClick={() => {
                        setEditingRateLimit(false);
                        // Reset to current saved value
                        const currentSetting = settings.find(s => s.key === 'nominatim_rate_variation_ms');
                        if (currentSetting?.value) {
                          setNominatimVariationMs(parseInt(currentSetting.value) || 500);
                        } else {
                          setNominatimVariationMs(500);
                        }
                      }}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRateLimit}
                      className="btn-primary text-sm"
                    >
                      Save Rate Limit
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-200">1.1s</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Minimum Delay</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          {(1.1 + nominatimVariationMs/1000).toFixed(1)}s
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Maximum Delay</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          ±{(nominatimVariationMs/1000).toFixed(1)}s
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Variation</div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 text-center">
                      Random timing helps avoid detection patterns while maintaining API compliance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 