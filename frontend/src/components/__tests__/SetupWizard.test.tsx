import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from '../SetupWizard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SetupWizard', () => {
  const mockOnComplete = vi.fn();
  
  beforeEach(() => {
    mockOnComplete.mockClear();
    vi.spyOn(window, 'fetch').mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  const renderSetupWizard = () => {
    return render(<SetupWizard onComplete={mockOnComplete} />);
  };

  it('renders the initial step', () => {
    renderSetupWizard();
    
    expect(screen.getByText(/Welcome to PlaceFinder/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your home address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Setup/i })).toBeDisabled();
  });

  it('enables submit button when address is entered', () => {
    renderSetupWizard();
    
    const addressInput = screen.getByPlaceholderText(/Enter your home address/i);
    const submitButton = screen.getByRole('button', { name: /Complete Setup/i });
    
    expect(submitButton).toBeDisabled();
    
    fireEvent.change(addressInput, { target: { value: '1 Test Street, Test City' } });
    
    expect(submitButton).not.toBeDisabled();
  });

  it('submits the form and calls onComplete', async () => {
    renderSetupWizard();
    
    const addressInput = screen.getByPlaceholderText(/Enter your home address/i);
    fireEvent.change(addressInput, { target: { value: '1 Test Street, Test City' } });
    
    const submitButton = screen.getByRole('button', { name: /Complete Setup/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledTimes(2);
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('shows error message when submission fails', async () => {
    vi.spyOn(window, 'fetch').mockImplementationOnce(() => 
      Promise.reject(new Error('Network error'))
    );
    
    renderSetupWizard();
    
    const addressInput = screen.getByPlaceholderText(/Enter your home address/i);
    fireEvent.change(addressInput, { target: { value: '1 Test Street, Test City' } });
    
    const submitButton = screen.getByRole('button', { name: /Complete Setup/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to save settings/i)).toBeInTheDocument();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });
}); 