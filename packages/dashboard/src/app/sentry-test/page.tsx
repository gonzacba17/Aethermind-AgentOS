'use client';

import { useState } from 'react';

export default function SentryTestPage() {
  const [message, setMessage] = useState('');

  const triggerClientError = () => {
    throw new Error('🧪 Test Sentry Error - Client Side');
  };

  const triggerServerError = async () => {
    try {
      const res = await fetch('/api/sentry-test');
      setMessage('Server error triggered - check Sentry dashboard');
    } catch (error) {
      setMessage('Error calling server API');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🧪 Sentry Test Page</h1>
      <p>Use these buttons to test Sentry error tracking:</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <button
          onClick={triggerClientError}
          style={{
            padding: '1rem',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          🔴 Trigger Client-Side Error
        </button>

        <button
          onClick={triggerServerError}
          style={{
            padding: '1rem',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          🔵 Trigger Server-Side Error
        </button>
      </div>

      {message && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: '2rem', fontSize: '14px', color: '#666' }}>
        <p>After triggering errors, check your Sentry dashboard:</p>
        <a
          href="https://sentry.io/organizations/aethermind-xt/issues/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#3498db' }}
        >
          🔗 Open Sentry Dashboard
        </a>
      </div>
    </div>
  );
}
