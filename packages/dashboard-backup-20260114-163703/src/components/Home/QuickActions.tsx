'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Play, BookOpen, Zap } from 'lucide-react';

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      icon: Bot,
      title: 'Create Agent',
      description: 'Set up a new AI agent for your workflows',
      color: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-l-blue-600 dark:border-l-blue-400',
      onClick: () => router.push('/dashboard/agents'),
    },
    {
      icon: Play,
      title: 'Run Demo',
      description: 'Execute a demo workflow to see agents in action',
      color: 'text-green-600 dark:text-green-400',
      borderColor: 'border-l-green-600 dark:border-l-green-400',
      onClick: () => {
        // This would trigger demo execution
        router.push('/dashboard');
      },
    },
    {
      icon: BookOpen,
      title: 'View Docs',
      description: 'Learn more about Aethermind AgentOS',
      color: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-l-purple-600 dark:border-l-purple-400',
      onClick: () => {
        window.open('https://github.com/aethermindai/agentos', '_blank');
      },
    },
    {
      icon: Zap,
      title: 'Quick Test',
      description: 'Test agent execution with a simple prompt',
      color: 'text-orange-600 dark:text-orange-400',
      borderColor: 'border-l-orange-600 dark:border-l-orange-400',
      onClick: () => {
        router.push('/dashboard/agents');
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-l-4 ${action.borderColor}`}
          onClick={action.onClick}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3">
                <action.icon className={`h-8 w-8 ${action.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
