"use client"

import { useState } from "react"
import { 
  Lightbulb, TrendingDown, Zap, Clock, DollarSign, 
  ChevronRight, CheckCircle2, Loader2, X, ArrowRight
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useCostsByModel, useCostSummary } from "@/hooks"
import { Skeleton } from "@/components/ui/skeleton"

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'model' | 'usage' | 'caching' | 'optimization';
  estimatedSavings: number;
  estimatedSavingsPercent: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  implemented?: boolean;
}

const impactColors = {
  high: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
}

const categoryIcons = {
  model: Zap,
  usage: Clock,
  caching: TrendingDown,
  optimization: Lightbulb,
}

export function CostRecommendations() {
  const { toast } = useToast()
  const { data: costsByModel, isLoading: modelLoading } = useCostsByModel()
  const { data: summary } = useCostSummary()
  const [implementedIds, setImplementedIds] = useState<Set<string>>(new Set())
  const [implementingId, setImplementingId] = useState<string | null>(null)
  
  // Generate recommendations based on actual data
  const recommendations: Recommendation[] = []
  
  if (costsByModel && costsByModel.length > 0) {
    // Find expensive model usage
    const gpt4Usage = costsByModel.find(m => m.model.toLowerCase().includes('gpt-4'))
    const gpt35Usage = costsByModel.find(m => m.model.toLowerCase().includes('gpt-3.5'))
    
    if (gpt4Usage && gpt4Usage.usage > 30) {
      recommendations.push({
        id: 'switch-model',
        title: 'Switch simple tasks to GPT-3.5',
        description: `You're using GPT-4 for ${gpt4Usage.usage}% of requests. For simple tasks like classification or formatting, GPT-3.5 Turbo is 10x cheaper with similar quality.`,
        impact: 'high',
        category: 'model',
        estimatedSavings: gpt4Usage.cost * 0.3,
        estimatedSavingsPercent: 30,
      })
    }
    
    // Check for potential caching opportunities
    if (summary && summary.executionCount > 100) {
      recommendations.push({
        id: 'enable-caching',
        title: 'Enable response caching',
        description: 'Based on your usage patterns, up to 20% of requests could be served from cache instead of making new API calls.',
        impact: 'high',
        category: 'caching',
        estimatedSavings: (summary.total || 0) * 0.2,
        estimatedSavingsPercent: 20,
      })
    }
  }
  
  // Add general optimization recommendations
  recommendations.push({
    id: 'prompt-optimization',
    title: 'Optimize prompt lengths',
    description: 'Reducing average prompt length by 20% could save tokens without affecting output quality. Focus on removing redundant instructions.',
    impact: 'medium',
    category: 'optimization',
    estimatedSavings: (summary?.total || 100) * 0.15,
    estimatedSavingsPercent: 15,
  })
  
  recommendations.push({
    id: 'batch-requests',
    title: 'Batch similar requests',
    description: 'Combine multiple small requests into batched operations to reduce overhead and improve efficiency.',
    impact: 'medium',
    category: 'usage',
    estimatedSavings: (summary?.total || 100) * 0.1,
    estimatedSavingsPercent: 10,
  })
  
  recommendations.push({
    id: 'set-max-tokens',
    title: 'Set appropriate max_tokens',
    description: 'Many requests use default max_tokens which may be higher than needed. Set specific limits based on expected output length.',
    impact: 'low',
    category: 'optimization',
    estimatedSavings: (summary?.total || 100) * 0.05,
    estimatedSavingsPercent: 5,
  })
  
  // Calculate totals
  const totalSavings = recommendations
    .filter(r => !implementedIds.has(r.id))
    .reduce((sum, r) => sum + r.estimatedSavings, 0)
  
  const implementedCount = implementedIds.size
  
  const handleImplement = async (recommendation: Recommendation) => {
    setImplementingId(recommendation.id)
    
    try {
      // Simulate API call
      await new Promise(r => setTimeout(r, 1500))
      
      setImplementedIds(prev => new Set([...prev, recommendation.id]))
      toast({
        title: "Recommendation Applied",
        description: `${recommendation.title} has been implemented. Estimated savings: $${recommendation.estimatedSavings.toFixed(2)}/month`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply recommendation",
        variant: "destructive",
      })
    } finally {
      setImplementingId(null)
    }
  }
  
  const handleDismiss = (id: string) => {
    setImplementedIds(prev => new Set([...prev, id]))
    toast({
      title: "Recommendation Dismissed",
      description: "You can view dismissed recommendations in settings",
    })
  }

  if (modelLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Cost Optimization
            </CardTitle>
            <CardDescription>
              Personalized recommendations to reduce your AI costs
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Potential savings</p>
            <p className="text-2xl font-bold text-emerald-500">${totalSavings.toFixed(2)}/mo</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        {implementedCount > 0 && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-500">
                {implementedCount} of {recommendations.length} recommendations applied
              </span>
              <span className="text-sm text-emerald-500">
                {Math.round((implementedCount / recommendations.length) * 100)}%
              </span>
            </div>
            <Progress 
              value={(implementedCount / recommendations.length) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Recommendations List */}
        <div className="space-y-3">
          {recommendations
            .filter(r => !implementedIds.has(r.id))
            .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
            .map(recommendation => {
              const impact = impactColors[recommendation.impact]
              const CategoryIcon = categoryIcons[recommendation.category]
              const isImplementing = implementingId === recommendation.id
              
              return (
                <div
                  key={recommendation.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${impact.bg}`}>
                        <CategoryIcon className={`h-5 w-5 ${impact.text}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{recommendation.title}</h4>
                          <Badge variant="outline" className={`text-xs ${impact.bg} ${impact.text} ${impact.border}`}>
                            {recommendation.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {recommendation.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm font-medium text-emerald-500">
                            Save ~${recommendation.estimatedSavings.toFixed(2)}/mo
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({recommendation.estimatedSavingsPercent}% reduction)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(recommendation.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleImplement(recommendation)}
                        disabled={isImplementing}
                        className="gap-1"
                      >
                        {isImplementing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Apply
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {/* All implemented message */}
        {recommendations.every(r => implementedIds.has(r.id)) && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="font-medium text-lg">All optimizations applied!</h3>
            <p className="text-muted-foreground mt-1">
              Great job! You've implemented all cost-saving recommendations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
