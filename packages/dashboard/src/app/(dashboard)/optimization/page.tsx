"use client"

import { useState } from "react"
import {
  Sparkles, DollarSign, Zap, RefreshCw, Calculator, ArrowRight,
  Loader2, Shrink, Copy, Check, ToggleLeft, ToggleRight,
  FileText, BookOpen, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  useOptimizationReport,
  useAvailableModels,
  useRoutingRules,
  useEstimateCost,
  useFindAlternatives,
  useCompressionStats,
  useCompressionSettings,
  useUpdateCompressionSettings,
  useAnalyzePrompt,
  useSystemPrompts,
  useSystemPromptTemplates,
  type PromptAnalysisResult,
} from "@/hooks/api/useOptimization"

export default function OptimizationPage() {
  const { toast } = useToast()

  // State — existing
  const [selectedModel, setSelectedModel] = useState('gpt-4')
  const [inputTokens, setInputTokens] = useState(1000)
  const [outputTokens, setOutputTokens] = useState(500)
  const [costEstimate, setCostEstimate] = useState<any>(null)
  const [alternatives, setAlternatives] = useState<any>(null)

  // State — Phase 4
  const [analyzerPrompt, setAnalyzerPrompt] = useState('')
  const [analysisResult, setAnalysisResult] = useState<PromptAnalysisResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)

  // API hooks — existing
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useOptimizationReport()
  const { data: modelsData, isLoading: modelsLoading } = useAvailableModels()
  const { data: rulesData } = useRoutingRules()
  const estimateCost = useEstimateCost()
  const findAlternatives = useFindAlternatives()

  // API hooks — Phase 4
  const { data: compressionStats, isLoading: statsLoading } = useCompressionStats()
  const { data: compressionSettings } = useCompressionSettings()
  const updateSettings = useUpdateCompressionSettings()
  const analyzePromptMutation = useAnalyzePrompt()
  const { data: systemPromptsData } = useSystemPrompts()
  const { data: templatesData } = useSystemPromptTemplates()

  const models = modelsData?.models || []
  const rules = rulesData?.rules || []
  const templates = templatesData?.templates || []
  const duplicates = systemPromptsData?.duplicates || []

  const handleEstimate = async () => {
    try {
      const result = await estimateCost.mutateAsync({
        model: selectedModel,
        inputTokens,
        outputTokens,
      })
      setCostEstimate(result)
    } catch (error) {
      toast({ title: "Error", description: "Failed to estimate cost", variant: "destructive" })
    }
  }

  const handleFindAlternatives = async () => {
    try {
      const result = await findAlternatives.mutateAsync({ model: selectedModel })
      setAlternatives(result)
    } catch (error) {
      toast({ title: "Error", description: "Failed to find alternatives", variant: "destructive" })
    }
  }

  const handleAnalyzePrompt = async () => {
    if (!analyzerPrompt.trim()) return
    try {
      const result = await analyzePromptMutation.mutateAsync({ prompt: analyzerPrompt })
      setAnalysisResult(result)
    } catch (error) {
      toast({ title: "Error", description: "Failed to analyze prompt", variant: "destructive" })
    }
  }

  const handleToggleCompression = async () => {
    try {
      await updateSettings.mutateAsync({
        compressionEnabled: !compressionSettings?.compressionEnabled,
      })
      toast({
        title: compressionSettings?.compressionEnabled ? "Compression disabled" : "Compression enabled",
        description: compressionSettings?.compressionEnabled
          ? "Automatic prompt compression has been turned off"
          : "Prompts will now be automatically compressed before each LLM call",
      })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" })
    }
  }

  const handleCopyOptimized = () => {
    if (analysisResult?.compressedPrompt) {
      navigator.clipboard.writeText(analysisResult.compressedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const impactColors = {
    high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  }

  const issueTypeColors: Record<string, string> = {
    'courtesy_padding': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    'verbose_negation': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'repeated_instruction': 'bg-red-500/10 text-red-400 border-red-500/20',
    'redundant_list_intro': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'context_redundancy': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  const issueTypeLabels: Record<string, string> = {
    'courtesy_padding': 'Courtesy Padding',
    'verbose_negation': 'Verbose Negation',
    'repeated_instruction': 'Repeated Instruction',
    'redundant_list_intro': 'Redundant List Intro',
    'context_redundancy': 'Context Redundancy',
  }

  const isLoading = reportLoading || modelsLoading || statsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Optimization</h1>
            <p className="text-muted-foreground">Reduce costs, compress prompts, and improve efficiency</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetchReport()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards — now with 4 cards including compression */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${report?.summary.totalCost.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Potential Savings</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ${report?.summary.potentialSavings.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Phase 4: Tokens Saved card */}
        <Card className="border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tokens Saved</p>
                <p className="text-2xl font-bold text-amber-500">
                  {compressionStats?.totalSavedTokens
                    ? (compressionStats.totalSavedTokens >= 1000
                      ? `${(compressionStats.totalSavedTokens / 1000).toFixed(1)}K`
                      : compressionStats.totalSavedTokens.toString())
                    : '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ${compressionStats?.totalSavedUsd?.toFixed(2) || '0.00'} saved
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Shrink className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Phase 4: Compression Rate card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Compression</p>
                <p className="text-2xl font-bold text-foreground">
                  {compressionStats?.avgCompressionPercent?.toFixed(1) || '0'}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {compressionStats?.compressionRate?.toFixed(1) || '0'}% of requests
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — extended with Phase 4 tabs */}
      <Tabs defaultValue="compression" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compression" id="tab-compression">
            <Shrink className="h-4 w-4 mr-1.5" />
            Compression
          </TabsTrigger>
          <TabsTrigger value="analyzer" id="tab-analyzer">
            <FileText className="h-4 w-4 mr-1.5" />
            Analyzer
          </TabsTrigger>
          <TabsTrigger value="system-prompts" id="tab-system-prompts">
            <BookOpen className="h-4 w-4 mr-1.5" />
            System Prompts
          </TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="estimator">Cost Estimator</TabsTrigger>
          <TabsTrigger value="rules">Routing Rules</TabsTrigger>
        </TabsList>

        {/* ============= Phase 4: Compression Tab ============= */}
        <TabsContent value="compression" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compression Opportunities Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shrink className="h-5 w-5 text-amber-500" />
                  Compression Opportunities
                </CardTitle>
                <CardDescription>
                  Automatic prompt compression reduces tokens before each LLM call
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="font-medium">Automatic Compression</p>
                    <p className="text-sm text-muted-foreground">
                      Compress prompts automatically when savings ≥ {((compressionSettings?.minCompressionRatio ?? 0.15) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleCompression}
                    disabled={updateSettings.isPending}
                    className="gap-2"
                    id="toggle-compression"
                  >
                    {updateSettings.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : compressionSettings?.compressionEnabled ? (
                      <ToggleRight className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                    {compressionSettings?.compressionEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Stats summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Requests Analyzed</p>
                    <p className="text-xl font-bold mt-1">{compressionStats?.totalRequests ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Compressed</p>
                    <p className="text-xl font-bold mt-1 text-emerald-500">{compressionStats?.compressedRequests ?? 0}</p>
                  </div>
                </div>

                {/* Savings bar */}
                {(compressionStats?.totalSavedTokens ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Compression savings</span>
                      <span className="font-medium text-emerald-500">
                        {compressionStats?.avgCompressionPercent?.toFixed(1)}% avg
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(compressionStats?.avgCompressionPercent ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardHeader>
                <CardTitle>How Compression Works</CardTitle>
                <CardDescription>Rule-based patterns applied to every prompt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { icon: '🧹', title: 'Courtesy Padding', description: 'Removes "please", "thank you", "could you kindly"', color: 'border-pink-500/20' },
                    { icon: '🔁', title: 'Repeated Instructions', description: 'Removes duplicate sentences conveying same instruction', color: 'border-red-500/20' },
                    { icon: '✋', title: 'Verbose Negation', description: '"Do not under any circumstances" → "Never"', color: 'border-orange-500/20' },
                    { icon: '📋', title: 'Redundant List Intros', description: '"Here is a list of:" before numbered list', color: 'border-yellow-500/20' },
                    { icon: '📄', title: 'Context Redundancy', description: 'Removes text duplicated across prompt sections', color: 'border-purple-500/20' },
                  ].map((rule) => (
                    <div key={rule.title} className={`flex items-start gap-3 p-3 rounded-lg border ${rule.color} bg-card`}>
                      <span className="text-lg">{rule.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{rule.title}</p>
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============= Phase 4: Interactive Analyzer Tab ============= */}
        <TabsContent value="analyzer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Prompt Analyzer
                </CardTitle>
                <CardDescription>
                  Paste a prompt to see how much it can be compressed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  id="analyzer-input"
                  placeholder="Paste your prompt here to analyze compression opportunities..."
                  value={analyzerPrompt}
                  onChange={(e) => setAnalyzerPrompt(e.target.value)}
                  rows={10}
                  className="resize-none font-mono text-sm"
                />
                <Button
                  id="analyze-prompt-btn"
                  onClick={handleAnalyzePrompt}
                  disabled={analyzePromptMutation.isPending || !analyzerPrompt.trim()}
                  className="w-full gap-2"
                >
                  {analyzePromptMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Analyze Prompt
                </Button>
              </CardContent>
            </Card>

            {/* Output */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  {analysisResult
                    ? `${analysisResult.issues.length} issue${analysisResult.issues.length !== 1 ? 's' : ''} found`
                    : 'Click "Analyze Prompt" to see results'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!analysisResult ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Paste a prompt and click "Analyze" to see results</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Token comparison */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30 border text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Original</p>
                        <p className="text-lg font-bold mt-1">{analysisResult.originalTokens}</p>
                        <p className="text-xs text-muted-foreground">tokens</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Compressed</p>
                        <p className="text-lg font-bold mt-1 text-emerald-500">
                          {analysisResult.estimatedCompressedTokens}
                        </p>
                        <p className="text-xs text-muted-foreground">tokens</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Saved</p>
                        <p className="text-lg font-bold mt-1 text-amber-500">
                          {Math.round((1 - analysisResult.compressionRatio) * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">reduction</p>
                      </div>
                    </div>

                    {/* Issues */}
                    {analysisResult.issues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Issues Found:</p>
                        {analysisResult.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs ${issueTypeColors[issue.type] || 'bg-muted'}`}
                              >
                                {issueTypeLabels[issue.type] || issue.type}
                              </Badge>
                              <span className="text-xs text-emerald-500 font-medium">
                                -{issue.tokensSaved} tokens
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{issue.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compressed prompt preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Optimized Prompt:</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyOptimized}
                          className="gap-1.5"
                          id="copy-optimized-btn"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-500">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border max-h-40 overflow-y-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                          {analysisResult.compressedPrompt}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============= Phase 4: System Prompts Tab ============= */}
        <TabsContent value="system-prompts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Duplicate Detection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Duplicate System Prompts
                </CardTitle>
                <CardDescription>
                  Agents with similar system prompts that could be consolidated
                </CardDescription>
              </CardHeader>
              <CardContent>
                {duplicates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                    <p>No duplicate system prompts detected</p>
                    <p className="text-sm mt-1">Your agents have distinct system prompts</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {duplicates.map((dup, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                            {(dup.similarity * 100).toFixed(0)}% similar
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {dup.agentIds.map((agentId) => (
                            <p key={agentId} className="text-xs font-mono text-muted-foreground truncate">
                              {agentId}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-violet-500" />
                  Optimized Templates
                </CardTitle>
                <CardDescription>
                  Pre-optimized system prompt templates by use case
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No templates available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.useCase} className="rounded-lg border bg-card overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedTemplate(
                            expandedTemplate === template.useCase ? null : template.useCase
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">{template.useCase}</Badge>
                            <span className="font-medium text-sm">{template.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              ~{template.estimatedTokens} tokens
                            </span>
                            {expandedTemplate === template.useCase ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        {expandedTemplate === template.useCase && (
                          <div className="px-3 pb-3 border-t">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                              {template.template}
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 gap-1.5"
                              onClick={() => {
                                navigator.clipboard.writeText(template.template)
                                toast({ title: "Copied!", description: `${template.name} template copied to clipboard` })
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy Template
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============= Existing: Recommendations Tab ============= */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>AI-generated suggestions to reduce costs</CardDescription>
            </CardHeader>
            <CardContent>
              {report?.recommendations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations at this time</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {report?.recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{rec.title}</h3>
                            <Badge variant="outline" className={impactColors[rec.impact]}>
                              {rec.impact} impact
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Implementation: {rec.implementation}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-emerald-500">
                            ${rec.estimatedSavings.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">potential savings</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= Existing: Models Tab ============= */}
        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Models</CardTitle>
              <CardDescription>Compare pricing across different AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Model</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Provider</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Input $/1K</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Output $/1K</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Context</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Capabilities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.model} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <span className="font-medium">{model.model}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">{model.provider}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          ${model.pricing.inputPer1kTokens.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          ${model.pricing.outputPer1kTokens.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(model.contextWindow / 1000).toFixed(0)}K
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {model.capabilities.slice(0, 3).map(cap => (
                              <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= Existing: Cost Estimator Tab ============= */}
        <TabsContent value="estimator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Cost Estimator
                </CardTitle>
                <CardDescription>Calculate costs for your API calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inputTokens">Input Tokens</Label>
                    <Input
                      id="inputTokens"
                      type="number"
                      min="0"
                      value={inputTokens}
                      onChange={(e) => setInputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outputTokens">Output Tokens</Label>
                    <Input
                      id="outputTokens"
                      type="number"
                      min="0"
                      value={outputTokens}
                      onChange={(e) => setOutputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEstimate} disabled={estimateCost.isPending} className="flex-1">
                    {estimateCost.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Estimate Cost
                  </Button>
                  <Button onClick={handleFindAlternatives} disabled={findAlternatives.isPending} variant="outline" className="flex-1">
                    {findAlternatives.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Find Alternatives
                  </Button>
                </div>

                {costEstimate && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Input Cost</span>
                      <span className="font-mono">${costEstimate.breakdown.inputCost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output Cost</span>
                      <span className="font-mono">${costEstimate.breakdown.outputCost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Total</span>
                      <span className="font-bold">${costEstimate.estimatedCost.toFixed(6)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cheaper Alternatives</CardTitle>
                <CardDescription>Models that could save you money</CardDescription>
              </CardHeader>
              <CardContent>
                {!alternatives ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Find Alternatives" to see cheaper options</p>
                  </div>
                ) : alternatives.alternatives.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No cheaper alternatives found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alternatives.alternatives.map((alt: any) => (
                      <div key={alt.model} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alt.model}</span>
                            <Badge variant="outline" className="capitalize text-xs">{alt.provider}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{alt.tradeoffs}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-500">
                            {alt.savingsPercent.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">savings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============= Existing: Routing Rules Tab ============= */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Routing Rules</CardTitle>
              <CardDescription>Automatic model selection based on conditions</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No routing rules configured</p>
                  <p className="text-sm mt-2">Rules automatically route requests to optimal models</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{rule.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Priority: {rule.priority} | Action: {rule.action.type}
                            {rule.action.model && ` to ${rule.action.model}`}
                          </p>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
