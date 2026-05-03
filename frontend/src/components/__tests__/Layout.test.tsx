import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '../Layout';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { describe, it, expect, vi } from 'vitest';

// Stub out the auth context so Layout has a logged-in admin user without
// hitting the real network on mount.
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', role: 'ADMIN', createdAt: '' },
    isLoading: false,
    isAuthenticated: true,
    setupRequired: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    setupAdmin: vi.fn(),
    checkSetupRequired: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

describe('Layout', () => {
  const renderLayout = () => {
    return render(
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<div>Test Content</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    );
  };

  it('renders navigation links', () => {
    renderLayout();
    
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('renders children content', () => {
    renderLayout();
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders the footer', () => {
    renderLayout();
    
    expect(screen.getByText(/© \d{4} Random Walk/)).toBeInTheDocument();
  });
}); 