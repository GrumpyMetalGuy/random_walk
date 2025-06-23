import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from '../SetupWizard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('SetupWizard', () => {
  const mockOnComplete = vi.fn();
  
  beforeEach(() => {
    mockOnComplete.mockClear();
    vi.spyOn(window, 'fetch').mockImplementation((_url) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  const renderSetupWizard = () => {
    return render(<SetupWizard onComplete={mockOnComplete} />);
  };

  it('renders the initial step for admin account creation', () => {
    renderSetupWizard();
    
    expect(screen.getByText(/Welcome to Random Walk/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your admin account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Choose an admin username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a secure password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next: Set Home Location/i })).toBeInTheDocument();
  });

  it('progresses through all three steps', async () => {
    renderSetupWizard();
    
    // Step 1: Admin account creation
    const usernameInput = screen.getByPlaceholderText(/Choose an admin username/i);
    const passwordInput = screen.getByPlaceholderText(/Enter a secure password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/Confirm your password/i);
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'verylongpasswordofatleast20characters' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'verylongpasswordofatleast20characters' } });
    
    const nextButton1 = screen.getByRole('button', { name: /Next: Set Home Location/i });
    fireEvent.click(nextButton1);
    
    // Step 2: Address setup
    await waitFor(() => {
      expect(screen.getByText(/Set up your home location/i)).toBeInTheDocument();
    });
    
    const addressInput = screen.getByPlaceholderText(/Enter your home address/i);
    fireEvent.change(addressInput, { target: { value: '1 Test Street, Test City' } });
    
    const nextButton2 = screen.getByRole('button', { name: /Next: Configure Distances/i });
    fireEvent.click(nextButton2);
    
    // Step 3: Distance configuration
    await waitFor(() => {
      expect(screen.getByText(/Configure distance preferences/i)).toBeInTheDocument();
    });
    
    expect(screen.getByText(/Distance Unit Preference/i)).toBeInTheDocument();
    expect(screen.getByText(/Search Distance Ranges/i)).toBeInTheDocument();
    
    const completeButton = screen.getByRole('button', { name: /Complete Setup/i });
    fireEvent.click(completeButton);
    
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('validates password requirements', () => {
    renderSetupWizard();
    
    const usernameInput = screen.getByPlaceholderText(/Choose an admin username/i);
    const passwordInput = screen.getByPlaceholderText(/Enter a secure password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/Confirm your password/i);
    const nextButton = screen.getByRole('button', { name: /Next: Set Home Location/i });
    
    // Short password should disable button
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });
    
    expect(nextButton).toBeDisabled();
    
    // Long password should enable button
    fireEvent.change(passwordInput, { target: { value: 'verylongpasswordofatleast20characters' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'verylongpasswordofatleast20characters' } });
    
    expect(nextButton).not.toBeDisabled();
  });
}); 