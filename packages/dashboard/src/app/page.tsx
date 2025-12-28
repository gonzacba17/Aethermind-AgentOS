'use client';

import { useEffect, useState } from 'react';
import { StatsGrid } from '@/components/Home/StatsGrid';
import { QuickActions } from '@/components/Home/QuickActions';
import { RecentActivity } from '@/components/Home/RecentActivity';
import { GettingStarted } from '@/components/Home/GettingStarted';
import { AlertBanner } from '@/components/Home/AlertBanner';
import { fetchAgents, fetchCostSummary, fetchHealth, type Agent, type CostSummary } from '@/lib/api';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [apiHealth, setApiHealth] = useState<{ status: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [agentsData, costsData, healthData] = await Promise.all([
          fetchAgents().catch(() => []),
          fetchCostSummary().catch(() => null),
          fetchHealth().catch(() => null),
        ]);
        
        setAgents(agentsData);
        setCostSummary(costsData);
        setApiHealth(healthData);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // Refresh data every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const isApiDisconnected = !apiHealth || apiHealth.status !== 'ok';
  const hasNoAgents = agents.length === 0;

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome to Aethermind</h1>
        <p className="text-muted-foreground text-lg">
          Get started by creating your first agent or running a demo workflow
        </p>
      </div>

      {/* Alert Banners */}
      <div className="space-y-3">
        <AlertBanner
          condition={isApiDisconnected}
          title="API Disconnected"
          message="The Aethermind API is not responding. Make sure the backend server is running on port 3001."
          storageKey="api-disconnected"
          variant="error"
        />
        
        <AlertBanner
          condition={hasNoAgents && !loading}
          title="Get Started"
          message="You haven't created any agents yet. Click 'Create Agent' below to set up your first AI agent."
          storageKey="no-agents"
          variant="info"
        />
      </div>

      {/* Stats Grid */}
      <StatsGrid
        agents={agents}
        costSummary={costSummary}
        apiHealth={apiHealth}
        loading={loading}
      />

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <RecentActivity />
        
        {/* Getting Started */}
        <GettingStarted />
      </div>
    </div>
  );
}
