import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setupRequired: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string, role?: 'ADMIN' | 'USER') => Promise<void>;
  setupAdmin: (username: string, password: string, distanceUnit?: 'miles' | 'kilometers', searchRanges?: number[]) => Promise<void>;
  checkSetupRequired: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;

  // Check if user is authenticated on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
        setSetupRequired(false);
      }
    } catch (error) {
      // If auth check fails, check if setup is required
      await checkSetupRequired();
    } finally {
      setIsLoading(false);
    }
  };

  const checkSetupRequired = async () => {
    try {
      const response = await axios.get('/api/auth/setup-required');
      setSetupRequired(response.data.setupRequired);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setSetupRequired(false);
    }
  };

  const login = async (username: string, password: string, rememberMe = false) => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
        rememberMe
      });

      if (response.data.success) {
        setUser(response.data.user);
        setSetupRequired(false);
        
        // Store token in localStorage for API requests
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        }

        // Navigate to appropriate page after login
        const currentPath = location.pathname;
        const user = response.data.user;
        
        // If user is on admin page but not an admin, redirect to home
        if (currentPath === '/admin' && user.role !== 'ADMIN') {
          navigate('/', { replace: true });
        }
        // If user is a regular user and on any admin-only route, redirect to home
        else if (user.role !== 'ADMIN' && currentPath.startsWith('/admin')) {
          navigate('/', { replace: true });
        }
        // For admins or users on valid routes, stay where they are
        
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const register = async (username: string, password: string, role: 'ADMIN' | 'USER' = 'USER') => {
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        password,
        role
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Registration failed');
    }
  };

  const setupAdmin = async (username: string, password: string, distanceUnit: 'miles' | 'kilometers' = 'miles', searchRanges?: number[]) => {
    try {
      const response = await axios.post('/api/auth/setup', {
        username,
        password,
        distanceUnit,
        searchRanges
      });

      if (response.data.success) {
        setSetupRequired(false);
        // After setup, automatically log in the admin user
        await login(username, password);
      } else {
        throw new Error(response.data.error || 'Setup failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Setup failed');
    }
  };

  // Set up axios interceptor to include token in requests
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Add response interceptor to handle auth errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          setUser(null);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    setupRequired,
    login,
    logout,
    register,
    setupAdmin,
    checkSetupRequired,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 