/**
 * Onboarding Page
 * 
 * Displayed after user signs up - shows API key and getting started instructions
 */

'use client';

import { useEffect, useState } from 'react';
import { ApiKeyDisplay } from '@/components/ApiKeyDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // TODO: Get from session/auth
    const mockApiKey = 'aether_' + Math.random().toString(36).substring(2, 15);
    setApiKey(mockApiKey);
    
    setOrganization({
      id: '1',
      name: 'My Organization',
      plan: 'FREE',
    });
  }, []);

  if (!organization) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto p-8">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Welcome to Aethermind!</h1>
        <p className="text-xl text-gray-600">
          Your organization "{organization.name}" is ready to go.
        </p>
      </div>

      {/* API Key Section */}
      <div className="mb-8">
        <ApiKeyDisplay apiKey={apiKey} organizationName={organization.name} />
      </div>

      {/* Next Steps */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>Get started with Aethermind in minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Install the SDK</h3>
                <p className="text-sm text-gray-600">
                  Add @aethermind/agent to your Node.js project
                </p>
                <code className="block mt-2 bg-gray-100 px-3 py-2 rounded text-sm">
                  npm install @aethermind/agent
                </code>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Initialize in your app</h3>
                <p className="text-sm text-gray-600">
                  Add one line to start tracking automatically
                </p>
                <code className="block mt-2 bg-gray-100 px-3 py-2 rounded text-sm">
                  initAethermind(&#123; apiKey: '{apiKey.slice(0, 20)}...' &#125;);
                </code>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Use AI APIs normally</h3>
                <p className="text-sm text-gray-600">
                  No code changes needed - we intercept calls automatically
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold shrink-0">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-1">View your dashboard</h3>
                <p className="text-sm text-gray-600">
                  See real-time cost metrics and usage analytics
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Plan: {organization.plan}</CardTitle>
          <CardDescription>Current limits and features</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>100 events per minute</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>30 days data retention</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Real-time dashboard</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Email alerts</span>
            </li>
          </ul>
          
          {organization.plan === 'FREE' && (
            <div className="mt-4">
              <Button variant="outline" className="w-full">
                Upgrade to STARTUP Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA Button */}
      <div className="text-center">
        <Button 
          size="lg" 
          onClick={() => router.push('/telemetry')}
          className="gap-2"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
