import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DollarSign, Bell, TrendingUp, Users, Bot, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: DollarSign,
    title: 'Budget Enforcement',
    description: 'Set hard limits per team, agent, or workflow. Executions blocked automatically when exceeded.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Email and Slack notifications at 80% and 100% of budget. Never be surprised by costs.',
  },
  {
    icon: TrendingUp,
    title: 'Cost Forecasting',
    description: 'Predict end-of-month spend based on usage patterns. Plan budgets with confidence.',
  },
  {
    icon: Users,
    title: 'Team Tracking',
    description: 'Assign costs to departments. Know exactly which teams consume the most tokens.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Monitoring',
    description: 'Monitor your AI agents in real-time with live cost tracking and performance metrics.',
  },
  {
    icon: Bot,
    title: 'Multi-Agent Orchestration',
    description: 'Create and orchestrate multiple AI agents working together on complex tasks.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Stop Overspending on AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Control your LLM costs with automatic budget limits, real-time alerts, 
            and predictive analytics. Built for enterprises using OpenAI, Anthropic, 
            and other AI providers in production.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard/costs">
              <Button size="lg">
                See Cost Dashboard
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Demo
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
