import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bot, BarChart3, FileText, GitBranch, Zap, Shield } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Multi-Agent Orchestration',
    description: 'Create and orchestrate multiple AI agents working together on complex tasks.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Monitoring',
    description: 'Monitor your agents in real-time with live logs and performance metrics.',
  },
  {
    icon: GitBranch,
    title: 'Decision Tracing',
    description: 'Visualize agent decision trees and understand how your agents think.',
  },
  {
    icon: FileText,
    title: 'Structured Logging',
    description: 'Comprehensive logging system with filtering and search capabilities.',
  },
  {
    icon: Zap,
    title: 'Workflow Engine',
    description: 'Define complex workflows with DAG-based execution and conditional branching.',
  },
  {
    icon: Shield,
    title: 'Cost Tracking',
    description: 'Track and analyze costs per agent, model, and execution.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Aethermind AgentOS
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            The Kubernetes for AI Agents. Build, orchestrate, monitor, and scale multi-agent AI systems with ease.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg">
                Open Dashboard
              </Button>
            </Link>
            <Link href="/dashboard/agents">
              <Button size="lg" variant="outline">
                View Agents
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Quick Start</h2>
          <Card>
            <CardContent className="pt-6">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import { createAgent, startOrchestrator } from '@aethermind/sdk'

const researcher = createAgent({
  name: "researcher",
  model: "gpt-4",
  systemPrompt: "You are a research assistant",
  logic: async (ctx) => {
    ctx.logger.info("Starting research...")
    return { result: "Research completed" }
  }
})

const orchestrator = startOrchestrator({
  agents: [researcher],
  provider: { type: 'openai', apiKey: process.env.OPENAI_API_KEY }
})

await orchestrator.executeTask("researcher", { topic: "AI Agents" })`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
