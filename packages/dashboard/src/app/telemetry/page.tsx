/**
 * Telemetry Dashboard Page
 * 
 * Displays real-time AI API cost metrics and usage statistics
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TelemetryMetrics {
  summary: {
    total Cost: number;
    totalRequests: number;
    totalTokens: number;
    avgLatency: number;
    errorRate: string;
    errors: number;
  };
  dailyCosts: Array<{
    date: Date;
    total_cost: number;
    event_count: number;
  }>;
  providerStats: Array<{
    provider: string;
    _sum: { cost: number | null };
    _count: { id: number };
  }>;
  recentEvents: Array<{
    id: string;
    timestamp: Date;
    provider: string;
    model: string;
    totalTokens: number;
    cost: number;
    latency: number;
    status: string;
    error: string | null;
  }>;
}

export default function TelemetryDashboard() {
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState('');

  useEffect(() => {
    // TODO: Get organizationId from session/auth
    // For now, use query param or env
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('orgId') || process.env.NEXT_PUBLIC_ORG_ID || '';
    setOrganizationId(orgId);
    
    if (orgId) {
      fetchMetrics(orgId);
      
      // Refresh every 30 seconds
      const interval = setInterval(() => fetchMetrics(orgId), 30000);
      return () => clearInterval(interval);
    }
  }, []);

  async function fetchMetrics(orgId: string) {
    try {
      const response = await fetch(`/api/metrics?organizationId=${orgId}&days=30`);
      const data = await response.json();
      setMetrics(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Data Available</h2>
          <p>Start using the SDK to see metrics here.</p>
        </div>
      </div>
    );
  }

  const { summary, dailyCosts, providerStats, recentEvents } = metrics;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Telemetry Dashboard</h1>
        <p className="text-gray-600 mt-2">Last 30 days of AI API usage</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Cost</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${summary.totalCost.toFixed(4)}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {summary.totalRequests.toLocaleString()} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Tokens</CardTitle>
            <CardDescription>Input + Output</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(summary.totalTokens / 1000).toFixed(1)}K
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {summary.totalRequests > 0 
                ? Math.round(summary.totalTokens / summary.totalRequests) 
                : 0} avg/request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Latency</CardTitle>
            <CardDescription>Response time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.avgLatency}ms
            </div>
            <p className="text-sm text-gray-500 mt-2">
              p50 latency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>Failed requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.errorRate}%
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {summary.errors} errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Daily Cost Trend</CardTitle>
          <CardDescription>Cost over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyCosts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => `$${value.toFixed(4)}`}
              />
              <Line 
                type="monotone" 
                dataKey="total_cost" 
                stroke="#8884d8" 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Provider Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Provider Breakdown</CardTitle>
          <CardDescription>Usage by provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {providerStats.map((stat) => (
              <div key={stat.provider} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="font-semibold capitalize">{stat.provider}</div>
                  <div className="text-sm text-gray-500 ml-4">
                    {stat._count.id} requests
                  </div>
                </div>
                <div className="font-bold">
                  ${(stat._sum.cost || 0).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Last 100 API calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Time</th>
                  <th className="text-left py-2 px-4">Provider</th>
                  <th className="text-left py-2 px-4">Model</th>
                  <th className="text-right py-2 px-4">Tokens</th>
                  <th className="text-right py-2 px-4">Cost</th>
                  <th className="text-right py-2 px-4">Latency</th>
                  <th className="text-center py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 capitalize">{event.provider}</td>
                    <td className="py-2 px-4 text-sm">{event.model}</td>
                    <td className="py-2 px-4 text-right">
{event.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      ${event.cost.toFixed(6)}
                    </td>
                    <td className="py-2 px-4 text-right">{event.latency}ms</td>
                    <td className="py-2 px-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          event.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
