/**
 * Organization Settings Page
 * 
 * Manage organization details, API keys, and team members
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiKeyDisplay } from '@/components/ApiKeyDisplay';
import { RefreshCw, Users, CreditCard } from 'lucide-react';

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    // TODO: Get from session/auth
    const orgId = 'org_123';
    
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      const data = await response.json();
      setOrganization(data.organization);
      setApiKey('aether_' + Math.random().toString(36).substring(2, 15)); // Mock
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    }
  }

  async function rotateApiKey() {
    setRotating(true);
    
    // TODO: Call API to rotate key
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newKey = 'aether_' + Math.random().toString(36).substring(2, 15);
    setApiKey(newKey);
    setRotating(false);
    
    alert('API key rotated successfully! Update your applications with the new key.');
  }

  if (!organization) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Organization Settings</h1>

      {/* Organization Details */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Manage your organization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Organization Name</Label>
            <Input 
              id="name" 
              value={organization.name} 
              onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input 
              id="slug" 
              value={organization.slug} 
              disabled
              className="bg-gray-50"
            />
            <p className="text-sm text-gray-500 mt-1">
              Used in URLs and API endpoints
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <div className="font-semibold">Current Plan</div>
              <div className="text-2xl font-bold text-blue-600">{organization.plan}</div>
            </div>
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing
            </Button>
          </div>

          <Button className="w-full">Save Changes</Button>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">API Key</h2>
            <p className="text-gray-600">Use this key to authenticate SDK requests</p>
          </div>
          <Button 
            variant="outline" 
            onClick={rotateApiKey}
            disabled={rotating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rotating ? 'animate-spin' : ''}`} />
            Rotate Key
          </Button>
        </div>
        
        <ApiKeyDisplay apiKey={apiKey} organizationName={organization.name} />
      </div>

      {/* Usage Stats */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Requests</div>
              <div className="text-3xl font-bold">
                {organization.usage24h?.requests.toLocaleString() || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Cost</div>
              <div className="text-3xl font-bold">
                ${organization.usage24h?.cost.toFixed(4) || '0.0000'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Rate Limit</span>
              <span className="font-semibold">{organization.rateLimitPerMin} events/min</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Total Events</span>
              <span className="font-semibold">{organization._count?.events.toLocaleString() || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {organization._count?.users || 0} members
              </CardDescription>
            </div>
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Team member management coming soon. Invite colleagues to collaborate on AI cost tracking.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
