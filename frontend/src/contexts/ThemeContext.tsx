import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isFollowingSystem: () => boolean;
  resetToSystem: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Function to detect system theme preference
function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light'; // fallback
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme as Theme;
    }
    
    // If no saved preference, use system preference
    return getSystemTheme();
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes (only if user hasn't manually set a preference)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only auto-update if this is the first time (no explicit user choice stored)
      const hasUserPreference = localStorage.getItem('theme');
      if (!hasUserPreference) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const isFollowingSystem = () => {
    return !localStorage.getItem('theme');
  };

  const resetToSystem = () => {
    localStorage.removeItem('theme');
    setTheme(getSystemTheme());
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isFollowingSystem, resetToSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 