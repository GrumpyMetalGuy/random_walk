import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '../Layout';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { describe, it, expect } from 'vitest';

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
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders children content', () => {
    renderLayout();
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders the footer', () => {
    renderLayout();
    
    expect(screen.getByText(/© \d{4} PlaceFinder/)).toBeInTheDocument();
  });
}); 