import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddressLink } from '../AddressLink';

describe('AddressLink', () => {
  beforeEach(() => {
    // happy-dom doesn't expose navigator.clipboard by default; stub it.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  });

  it('renders the address with the 📍 prefix', () => {
    render(<AddressLink address="1 High Street, Anytown, AN1 2BC" />);
    expect(screen.getByRole('button')).toHaveTextContent('📍 1 High Street, Anytown, AN1 2BC');
  });

  it('copies the address to the clipboard on click and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<AddressLink address="1 High Street" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('1 High Street');
    });
    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });
});
