import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:4000';

// Configure axios to include credentials
axios.defaults.withCredentials = true;

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
  setupAdmin: (username: string, password: string) => Promise<void>;
  checkSetupRequired: () => Promise<void>;
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

  const isAuthenticated = !!user;

  // Check if user is authenticated on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
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
      const response = await axios.get(`${API_URL}/api/auth/setup-required`);
      setSetupRequired(response.data.setupRequired);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setSetupRequired(false);
    }
  };

  const login = async (username: string, password: string, rememberMe = false) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
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
      await axios.post(`${API_URL}/api/auth/logout`);
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
      const response = await axios.post(`${API_URL}/api/auth/register`, {
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

  const setupAdmin = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/setup`, {
        username,
        password
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
    checkSetupRequired
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 