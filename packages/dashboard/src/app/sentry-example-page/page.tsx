'use client';

import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';

export default function SentryExamplePage() {
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTestError = async () => {
    try {
      setIsLoading(true);
      setStatus('');
      
      const testError = new Error('This is a test error from Sentry Example Page');
      
      Sentry.captureException(testError);
      
      setStatus('✅ Error captured and sent to Sentry!');
      console.log('Error captured:', testError);
    } catch (error) {
      console.error('Failed to capture error:', error);
      setStatus('❌ Failed to capture error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureMessage = async () => {
    try {
      setIsLoading(true);
      setStatus('');
      
      Sentry.captureMessage('This is a test message from Sentry Example Page', 'info');
      
      setStatus('✅ Message sent to Sentry!');
      console.log('Message captured to Sentry');
    } catch (error) {
      console.error('Failed to send message:', error);
      setStatus('❌ Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWarning = async () => {
    try {
      setIsLoading(true);
      setStatus('');
      
      Sentry.captureMessage('This is a test warning from Sentry Example Page', 'warning');
      
      setStatus('✅ Warning sent to Sentry!');
    } catch (error) {
      console.error('Failed to send warning:', error);
      setStatus('❌ Failed to send warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Sentry Example Page</h1>
      <p>Test Sentry integration with the buttons below:</p>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleTestError}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isLoading ? '#a78bfa' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isLoading ? 'Sending...' : 'Capture Test Error'}
        </button>

        <button
          onClick={handleCaptureMessage}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isLoading ? '#a78bfa' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isLoading ? 'Sending...' : 'Send Test Message'}
        </button>

        <button
          onClick={handleTestWarning}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isLoading ? '#a78bfa' : '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isLoading ? 'Sending...' : 'Send Test Warning'}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: status.includes('✅') ? '#dcfce7' : '#fee2e2',
            color: status.includes('✅') ? '#166534' : '#991b1b',
            borderRadius: '0.375rem',
            border: `1px solid ${status.includes('✅') ? '#86efac' : '#fca5a5'}`,
            fontSize: '0.95rem'
          }}
        >
          {status}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem' }}>
        <h3>Instructions:</h3>
        <ul>
          <li><strong>Capture Test Error:</strong> Sends a test error to Sentry without crashing the page</li>
          <li><strong>Send Test Message:</strong> Sends an info message to Sentry</li>
          <li><strong>Send Test Warning:</strong> Sends a warning message to Sentry</li>
          <li>You can click the buttons multiple times - no page refresh needed</li>
          <li>Check your Sentry dashboard to see the events in real-time</li>
          <li>All events are captured and sent to: <code>aethermind-xt/javascript-nextjs</code></li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', border: '1px solid #bfdbfe' }}>
        <h3>Status:</h3>
        <ul style={{ fontSize: '0.9rem', margin: '0.5rem 0' }}>
          <li>Sentry DSN: Configured ✅</li>
          <li>Error tracking: Active ✅</li>
          <li>Message capture: Active ✅</li>
          <li>Environment: Development</li>
        </ul>
      </div>
    </div>
  );
}
