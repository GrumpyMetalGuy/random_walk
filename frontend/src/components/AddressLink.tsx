import { useState } from 'react';

interface AddressLinkProps {
  address: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
  // navigator.clipboard.writeText is only available in secure contexts
  // (https or localhost). Fall back to the legacy textarea+execCommand path
  // when accessing the dev server over a LAN IP, etc.
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function AddressLink({ address }: AddressLinkProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleClick = async () => {
    const ok = await copyToClipboard(address);
    setStatus(ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to copy address to clipboard"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left"
    >
      📍 {address}
      {status === 'copied' && (
        <span className="ml-1 text-green-600 dark:text-green-400 no-underline">(copied!)</span>
      )}
      {status === 'failed' && (
        <span className="ml-1 text-red-600 dark:text-red-400 no-underline">(copy failed)</span>
      )}
    </button>
  );
}
