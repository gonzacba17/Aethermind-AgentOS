"use client"

import { useState, useEffect, useCallback } from "react"
import { Bot, GitBranch, FileText, DollarSign, BarChart3, Copy, Check, Key, Terminal, Code2, Eye, EyeOff, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useAuthStore } from "@/store/useAuthStore"
import { useTimeAgo } from "@/hooks/useTimeAgo"

const quickLinks = [
  {
    title: "Dashboard",
    description: "View real-time metrics and agent performance",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Agents",
    description: "Manage and configure your AI agents",
    href: "/agents",
    icon: Bot,
  },
  {
    title: "Traces",
    description: "Analyze agent execution traces and workflows",
    href: "/traces",
    icon: GitBranch,
  },
  {
    title: "Logs",
    description: "Monitor system logs and events",
    href: "/logs",
    icon: FileText,
  },
  {
    title: "Costs",
    description: "Track API usage and cost analytics",
    href: "/costs",
    icon: DollarSign,
  },
]

function SDKKeyCard() {
  const client = useAuthStore((s) => s.client)
  const refreshClient = useAuthStore((s) => s.refreshClient)
  const [copied, setCopied] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const updatedAgo = useTimeAgo(lastRefresh)

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await refreshClient()
    setLastRefresh(Date.now())
    setIsRefreshing(false)
  }, [refreshClient])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(doRefresh, 30_000)
    return () => clearInterval(id)
  }, [doRefresh])

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
    <Card className="bg-[#111] border border-white/[0.06] rounded-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-white/40" />
            <div>
              <CardTitle className="text-lg font-light text-white">
                {client?.companyName ? `Welcome, ${client.companyName}` : 'Your SDK API Key'}
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-white/40">
                Use this key to connect the @aethermind/agent SDK to your application
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {updatedAgo && (
              <span className="text-[11px] text-white/25 font-mono tabular-nums">
                {isRefreshing ? 'updating...' : `updated ${updatedAgo}`}
              </span>
            )}
            <button
              onClick={doRefresh}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* API Key */}
        <div className="p-4 bg-[#111] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-white/40" />
              <span className="font-light text-white/50">SDK API Key</span>
            </div>
            <div className="flex items-center gap-2">
              {sdkApiKey && (
                <>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(sdkApiKey, 'SDK Key')}
                    className="text-white/40 hover:text-white/70 transition-colors"
                  >
                    {copied === 'SDK Key' ? (
                      <Check className="h-4 w-4 text-[#00BFA5]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          {sdkApiKey ? (
            <code className="block p-3 bg-black border border-white/[0.1] font-mono text-sm break-all text-white/70">
              {showKey ? sdkApiKey : maskedKey}
            </code>
          ) : (
            <div className="p-3 bg-black border border-white/[0.06]">
              <span className="text-white/30 text-sm">No SDK key found — key is generated automatically on signup.</span>
            </div>
          )}
        </div>

        {/* Install / Connect tabs */}
        <Tabs defaultValue="install" className="w-full">
          <TabsList className="bg-transparent border-b border-white/[0.06] rounded-none w-full justify-start gap-0 p-0">
            <TabsTrigger value="install" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-white/70 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white px-4 py-2">
              <Terminal className="h-4 w-4" />
              1. Install
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-white/70 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white px-4 py-2">
              <Code2 className="h-4 w-4" />
              2. Connect
            </TabsTrigger>
          </TabsList>

          <TabsContent value="install" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-white/40">
                Install the Aethermind SDK in your project:
              </p>
              <div className="relative">
                <pre className="p-4 bg-black border border-white/[0.1] text-white/70 font-mono text-sm overflow-x-auto">
                  <code>{installCode}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-white/30 hover:text-white/70"
                  onClick={() => handleCopy(installCode, 'Install')}
                >
                  {copied === 'Install' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connect" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-white/40">
                Add this code to connect your application:
              </p>
              <div className="relative">
                <pre className="p-4 bg-black border border-white/[0.1] text-white/70 font-mono text-sm overflow-x-auto max-h-64">
                  <code>{connectCode}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-white/30 hover:text-white/70"
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

      {/* Quick Navigation */}
      <div>
        <span className="font-mono text-[9px] text-white/20 uppercase tracking-[0.12em]">Quick Navigation</span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4 border border-white/[0.06]">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-start gap-3 p-5 border border-white/[0.06] hover:border-white/[0.15] transition-colors cursor-pointer group">
                <link.icon className="h-5 w-5 text-white/40 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-light text-white group-hover:text-white">{link.title}</h3>
                  <p className="text-sm text-white/30 mt-1">
                    {link.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <Card className="bg-[#111] border border-white/[0.06] rounded-none">
        <CardHeader>
          <CardTitle className="font-light text-white">Getting Started</CardTitle>
          <CardDescription className="text-white/40">
            New to Aethermind AgentOS? Here are some resources to help you get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-white/[0.06]">
            <div className="p-4 border border-white/[0.06]">
              <h3 className="font-light text-white mb-2">1. Configure Agents</h3>
              <p className="text-sm text-white/30">
                Set up your AI agents with custom configurations and connect them to your workflows.
              </p>
            </div>
            <div className="p-4 border border-white/[0.06]">
              <h3 className="font-light text-white mb-2">2. Monitor Performance</h3>
              <p className="text-sm text-white/30">
                Track agent performance, response times, and success rates in real-time.
              </p>
            </div>
            <div className="p-4 border border-white/[0.06]">
              <h3 className="font-light text-white mb-2">3. Optimize Costs</h3>
              <p className="text-sm text-white/30">
                Analyze token usage and optimize your AI operations for cost efficiency.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
