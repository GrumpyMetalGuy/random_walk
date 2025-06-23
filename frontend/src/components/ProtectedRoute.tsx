import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Login } from '../pages/Login';
import { SetupWizard } from './SetupWizard';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, isLoading, isAuthenticated, setupRequired, checkAuth } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show setup page if no users exist
  if (setupRequired) {
    return <SetupWizard onComplete={checkAuth} />;
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Check admin requirement
  if (requireAdmin && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full">
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
                Access Denied
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300">
                You need administrator privileges to access this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}; 