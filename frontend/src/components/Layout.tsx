import { Link, Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function Layout() {
  console.log('Layout component rendering');
  const { theme, toggleTheme, isFollowingSystem, resetToSystem } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleThemeDoubleClick = () => {
    if (!isFollowingSystem()) {
      resetToSystem();
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-lg dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  Random Walk
                </span>
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  Home
                </Link>
                <Link
                  to="/places"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Places
                </Link>
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Welcome, {user.username}
                    {user.role === 'ADMIN' && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Admin
                      </span>
                    )}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    Logout
                  </button>
                </div>
              )}
              <button
                onClick={toggleTheme}
                onDoubleClick={handleThemeDoubleClick}
                className="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 relative group"
                title={`Theme: ${theme} ${isFollowingSystem() ? '(following system)' : '(manual)'}`}
              >
                <span className="text-lg">
                  {theme === 'dark' ? '🌞' : '🌙'}
                </span>
                {isFollowingSystem() && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" 
                        title="Following system theme"></span>
                )}
                
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  {isFollowingSystem() 
                    ? `Auto: ${theme} (system)` 
                    : `Manual: ${theme} • Double-click to reset to system`
                  }
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white shadow-lg dark:bg-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Random Walk
          </p>
        </div>
      </footer>
    </div>
  );
} 