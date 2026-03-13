"use client"

import { useState } from "react"
import {
  Zap,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Code2,
  Key,
  Rocket,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useUserProfile, useTestSDKConnection, useRegenerateApiKey } from "@/hooks/api/useUserProfile"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

export function SDKConnectCard() {
  const { toast } = useToast()
  const { data: user, isLoading, error } = useUserProfile()
  const testConnection = useTestSDKConnection()
  const regenerateKey = useRegenerateApiKey()

  const [copied, setCopied] = useState<string | null>(null)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  // Holds the newly generated key shown only once
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const sdkApiKeyPrefix = user?.sdkApiKeyPrefix || null

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      })
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      })
    }
  }

  const handleTestConnection = async () => {
    if (!sdkApiKeyPrefix) return

    try {
      // Test connection uses the prefix just to verify connectivity
      await testConnection.mutateAsync(sdkApiKeyPrefix)
      setConnectionStatus('success')
      toast({
        title: "Connection Successful!",
        description: "Your SDK is properly configured and connected",
      })
    } catch {
      setConnectionStatus('error')
      toast({
        title: "Connection Failed",
        description: "Unable to connect. Check your API key and try again.",
        variant: "destructive",
      })
    }
  }

  const handleRegenerateKey = async () => {
    try {
      const newKey = await regenerateKey.mutateAsync()
      setShowRegenerateDialog(false)
      setRevealedKey(newKey)
    } catch {
      toast({
        title: "Failed to regenerate",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  const installCode = `npm install @aethermind/agent`

  const connectionCode = `import { initAethermind } from '@aethermind/agent';

// Initialize telemetry — auto-instruments OpenAI & Anthropic SDKs
initAethermind({
  apiKey: 'YOUR_SDK_API_KEY',
  endpoint: '${process.env.NEXT_PUBLIC_API_URL || 'https://aethermind-agentos-production.up.railway.app'}',
});

// That's it! All OpenAI/Anthropic calls are now tracked.
import OpenAI from 'openai';
const openai = new OpenAI();

const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Cost, tokens, and latency are automatically reported to your dashboard.`

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed border-primary/50 bg-gradient-to-br from-primary/5 via-primary/10 to-background">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !user) {
    return (
      <Card className="border-2 border-dashed border-amber-500/50 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-background">
        <CardContent className="py-12 text-center">
          <XCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign in to Connect SDK</h3>
          <p className="text-muted-foreground mb-4">
            Create an account or sign in to get your API key and connect the SDK.
          </p>
          <Button asChild>
            <a href="/login">Sign In</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="relative overflow-hidden border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg shadow-primary/10">
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary text-primary-foreground animate-pulse">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  Connect Your Project
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    Required
                  </Badge>
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Link your application to Aethermind AgentOS in 2 minutes
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === 'success' && (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-6">
          {/* API Key Section */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <span className="font-medium">Your SDK API Key</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowRegenerateDialog(true)}
              >
                <RefreshCw className="h-4 w-4" />
                {sdkApiKeyPrefix ? 'Regenerate' : 'Generate Key'}
              </Button>
            </div>
            {sdkApiKeyPrefix ? (
              <code className="block p-3 rounded-lg bg-muted font-mono text-sm">
                {sdkApiKeyPrefix}
              </code>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-amber-500">
                  No SDK API key found. Click "Generate Key" to create one.
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              For security, only the prefix is shown. Regenerate to get the full key.
            </p>
          </div>

          {/* Steps */}
          <Tabs defaultValue="install" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="install" className="gap-2">
                <Terminal className="h-4 w-4" />
                1. Install
              </TabsTrigger>
              <TabsTrigger value="connect" className="gap-2">
                <Code2 className="h-4 w-4" />
                2. Connect
              </TabsTrigger>
              <TabsTrigger value="test" className="gap-2">
                <Rocket className="h-4 w-4" />
                3. Test
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
                    onClick={() => handleCopy(installCode, 'Install command')}
                  >
                    {copied === 'Install command' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                    <code>{connectionCode}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-100"
                    onClick={() => handleCopy(connectionCode, 'Connection code')}
                  >
                    {copied === 'Connection code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="test" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Verify your connection is working properly:
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    size="lg"
                    className="gap-2 bg-primary hover:bg-primary/90 text-lg px-8 py-6 shadow-lg shadow-primary/25"
                    onClick={handleTestConnection}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Test Connection
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>

                  {connectionStatus === 'success' && (
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Connection verified!</span>
                    </div>
                  )}

                  {connectionStatus === 'error' && (
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Connection failed</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{user.usageCount || 0}</div>
              <div className="text-xs text-muted-foreground">API Calls</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{user.maxAgents}</div>
              <div className="text-xs text-muted-foreground">Max Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary capitalize">{user.plan}</div>
              <div className="text-xs text-muted-foreground">Plan</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sdkApiKeyPrefix ? 'Regenerate SDK API Key?' : 'Generate SDK API Key'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sdkApiKeyPrefix
                ? 'This will invalidate your current SDK API key. Any applications using the old key will stop working. You\'ll need to update your SDK configuration with the new key.'
                : 'This will generate a new SDK API key for your account. You\'ll be shown the key once — make sure to copy it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateKey}
              className={sdkApiKeyPrefix ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {regenerateKey.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : sdkApiKeyPrefix ? (
                'Regenerate Key'
              ) : (
                'Generate Key'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revealed Key Dialog — shown once after generate/regenerate */}
      <Dialog open={!!revealedKey} onOpenChange={(open) => { if (!open) setRevealedKey(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
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
              onClick={() => revealedKey && handleCopy(revealedKey, 'SDK API Key')}
            >
              {copied === 'SDK API Key' ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </>
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
