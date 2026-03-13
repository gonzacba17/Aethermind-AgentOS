"use client"

import { useState } from "react"
import { Home, ArrowRight, Bot, GitBranch, FileText, DollarSign, BarChart3, Copy, Check, Key, Terminal, Code2, RefreshCw, AlertTriangle, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"
import { useAuthStore } from "@/store/useAuthStore"
import { useRegenerateApiKey } from "@/hooks/api/useUserProfile"

// ─── Previous version used SDKConnectCard with useUserProfile hook ───
// import { SDKConnectCard } from "@/components/dashboard/SDKConnectCard"

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
  const [copied, setCopied] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const regenerateKey = useRegenerateApiKey()
  const refreshClient = useAuthStore((s) => s.refreshClient)

  const sdkApiKeyPrefix = client?.sdkApiKeyPrefix || null

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  const handleGenerateKey = async () => {
    try {
      const newKey = await regenerateKey.mutateAsync()
      setRevealedKey(newKey)
      // Re-fetch /me to update sdkApiKeyPrefix in store
      refreshClient()
    } catch {
      // error handled by toast in hook
    }
  }

  const installCode = `npm install @aethermind/agent`

  const connectCode = `import { initAethermind } from '@aethermind/agent';

initAethermind({
  apiKey: 'YOUR_SDK_API_KEY',
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
    <>
    <Card className="bg-[#111] border border-white/[0.06] rounded-none">
      <CardHeader>
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
              {sdkApiKeyPrefix && (
                <button
                  onClick={() => handleCopy(sdkApiKeyPrefix, 'SDK Key Prefix')}
                  className="text-white/40 hover:text-white/70 transition-colors"
                >
                  {copied === 'SDK Key Prefix' ? (
                    <Check className="h-4 w-4 text-[#00BFA5]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={handleGenerateKey}
                className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 text-sm"
                disabled={regenerateKey.isPending}
              >
                {regenerateKey.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {sdkApiKeyPrefix ? (
            <code className="block p-3 bg-black border border-white/[0.1] font-mono text-sm break-all text-white/70">
              {sdkApiKeyPrefix}
            </code>
          ) : (
            <div className="p-3 bg-black border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-amber-500/70 text-sm">No SDK key found</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-2"
                  onClick={handleGenerateKey}
                  disabled={regenerateKey.isPending}
                >
                  {regenerateKey.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                  ) : (
                    <><Key className="h-3 w-3" /> Generate Key</>
                  )}
                </Button>
              </div>
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

    {/* Revealed Key Modal */}
    <Dialog open={!!revealedKey} onOpenChange={(open) => { if (!open) setRevealedKey(null) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your New SDK API Key
          </DialogTitle>
          <DialogDescription>
            Copy this key now — you will not be able to see it again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-500 font-medium">
                This is the only time this key will be shown. Store it securely.
              </p>
            </div>
            <code className="block p-3 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-sm break-all select-all">
              {revealedKey}
            </code>
          </div>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => revealedKey && handleCopy(revealedKey, 'SDK Key')}
          >
            {copied === 'SDK Key' ? (
              <><Check className="h-4 w-4" /> Copied!</>
            ) : (
              <><Copy className="h-4 w-4" /> Copy to Clipboard</>
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRevealedKey(null)}>
            I've saved my key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
          {quickLinks.map((link, index) => (
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
