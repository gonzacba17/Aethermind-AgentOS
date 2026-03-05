"use client"

import { useState } from "react"
import { Home, ArrowRight, Bot, GitBranch, FileText, DollarSign, BarChart3, Copy, Check, Key, Terminal, Code2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useAuthStore } from "@/store/useAuthStore"

// ─── Previous version used SDKConnectCard with useUserProfile hook ───
// import { SDKConnectCard } from "@/components/dashboard/SDKConnectCard"

const quickLinks = [
  {
    title: "Dashboard",
    description: "View real-time metrics and agent performance",
    href: "/dashboard",
    icon: BarChart3,
    color: "from-blue-500/20 to-blue-600/20",
    iconColor: "text-blue-500",
  },
  {
    title: "Agents",
    description: "Manage and configure your AI agents",
    href: "/agents",
    icon: Bot,
    color: "from-violet-500/20 to-violet-600/20",
    iconColor: "text-violet-500",
  },
  {
    title: "Traces",
    description: "Analyze agent execution traces and workflows",
    href: "/traces",
    icon: GitBranch,
    color: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-500",
  },
  {
    title: "Logs",
    description: "Monitor system logs and events",
    href: "/logs",
    icon: FileText,
    color: "from-amber-500/20 to-amber-600/20",
    iconColor: "text-amber-500",
  },
  {
    title: "Costs",
    description: "Track API usage and cost analytics",
    href: "/costs",
    icon: DollarSign,
    color: "from-rose-500/20 to-rose-600/20",
    iconColor: "text-rose-500",
  },
]

function SDKKeyCard() {
  const client = useAuthStore((s) => s.client)
  const [copied, setCopied] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const sdkApiKey = client?.sdkApiKey || ''
  const maskedKey = sdkApiKey
    ? `${sdkApiKey.slice(0, 14)}${'•'.repeat(20)}${sdkApiKey.slice(-4)}`
    : ''

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  const installCode = `npm install @aethermind/agent`

  const connectCode = `import { initAethermind } from '@aethermind/agent';

initAethermind({
  apiKey: '${showKey ? sdkApiKey : 'YOUR_SDK_API_KEY'}',
  endpoint: '${process.env.NEXT_PUBLIC_API_URL || 'https://aethermind-agentos-production.up.railway.app'}',
});

// Your existing AI code works as usual — Aethermind
// automatically tracks costs, tokens, and latency.
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`

  return (
    <Card className="relative overflow-hidden border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg shadow-primary/10">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary text-primary-foreground">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {client?.companyName ? `Welcome, ${client.companyName}` : 'Your SDK API Key'}
            </CardTitle>
            <CardDescription className="text-base mt-1">
              Use this key to connect the @aethermind/agent SDK to your application
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* API Key */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span className="font-medium">SDK API Key</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Hide' : 'Show'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(sdkApiKey, 'SDK Key')}
              >
                {copied === 'SDK Key' ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <code className="block p-3 rounded-lg bg-muted font-mono text-sm break-all">
            {showKey ? sdkApiKey : maskedKey}
          </code>
        </div>

        {/* Install / Connect tabs */}
        <Tabs defaultValue="install" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="install" className="gap-2">
              <Terminal className="h-4 w-4" />
              1. Install
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-2">
              <Code2 className="h-4 w-4" />
              2. Connect
            </TabsTrigger>
          </TabsList>

          <TabsContent value="install" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install the Aethermind SDK in your project:
              </p>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-sm overflow-x-auto">
                  <code>{installCode}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-100"
                  onClick={() => handleCopy(installCode, 'Install')}
                >
                  {copied === 'Install' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connect" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add this code to connect your application:
              </p>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-sm overflow-x-auto max-h-64">
                  <code>{connectCode}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-100"
                  onClick={() => handleCopy(connectCode, 'Connect')}
                >
                  {copied === 'Connect' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* SDK Key Card */}
      <SDKKeyCard />

      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border p-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Home className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to Aethermind AgentOS
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Your central hub for managing, monitoring, and optimizing AI agents.
            Get started by exploring the sections below or dive into the dashboard for real-time insights.
          </p>
          <div className="mt-6 flex gap-4">
            <Button asChild size="lg" className="group">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/agents">
                Manage Agents
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${link.color}`}>
                      <link.icon className={`h-5 w-5 ${link.iconColor}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {link.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            New to Aethermind AgentOS? Here are some resources to help you get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground mb-2">1. Configure Agents</h3>
              <p className="text-sm text-muted-foreground">
                Set up your AI agents with custom configurations and connect them to your workflows.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground mb-2">2. Monitor Performance</h3>
              <p className="text-sm text-muted-foreground">
                Track agent performance, response times, and success rates in real-time.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground mb-2">3. Optimize Costs</h3>
              <p className="text-sm text-muted-foreground">
                Analyze token usage and optimize your AI operations for cost efficiency.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
