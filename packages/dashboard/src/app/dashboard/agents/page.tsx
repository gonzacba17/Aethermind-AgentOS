'use client';

import { useEffect, useState } from 'react';
import { AgentCard } from '@/components/AgentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { CreateAgentModal } from '@/components/CreateAgentModal';
import { fetchAgents, createAgent, executeAgent, type Agent } from '@/lib/api';
import { Plus, RefreshCw } from 'lucide-react';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleExecute = async (agent: Agent) => {
    try {
      await executeAgent(agent.id, { test: true });
      loadAgents();
    } catch (error) {
      console.error('Failed to execute agent:', error);
    }
  };

  const handleAgentCreated = (agent: Agent) => {
    loadAgents();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agents</h1>
        <div className="flex gap-2">
          <BackToHomeButton />
          <Button variant="outline" onClick={loadAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading agents...</div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No agents registered yet. Create your first agent to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onExecute={handleExecute} />
          ))}
        </div>
      )}

      <CreateAgentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleAgentCreated}
        existingAgents={agents}
        onCreateAgent={createAgent}
      />
    </div>
  );
}
