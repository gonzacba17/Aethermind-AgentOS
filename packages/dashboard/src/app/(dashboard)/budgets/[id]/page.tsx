"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Wallet, DollarSign, TrendingUp, AlertTriangle, Pause, Play, Trash2, Settings, Loader2, RefreshCw, Calendar, Clock, Shield, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useBudgetDetail, useBudgetUsage, useDeleteBudget, usePauseBudget, getBudgetProgressInfo } from "@/hooks/api/useBudget"
import { useState } from "react"

interface BudgetDetailPageProps {
  params: Promise<{ id: string }>
}

export default function BudgetDetailPage({ params }: BudgetDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const { data: budget, isLoading, error, refetch } = useBudgetDetail(id)
  const { data: usage } = useBudgetUsage(id)
  const deleteBudget = useDeleteBudget()
  const pauseBudget = usePauseBudget()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteBudget.mutateAsync(id)
      toast({
        title: "Budget Deleted",
        description: "The budget has been deleted successfully.",
      })
      router.push('/budgets')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete budget",
        variant: "destructive",
      })
    }
  }

  const handlePause = async () => {
    if (!budget) return
    const isPaused = (budget as any).status === 'paused'
    try {
      await pauseBudget.mutateAsync({ id, paused: !isPaused })
      toast({
        title: isPaused ? "Budget Resumed" : "Budget Paused",
        description: `The budget has been ${isPaused ? 'resumed' : 'paused'}.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update budget",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !budget) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/budgets')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Budgets
        </Button>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Budget not found or failed to load</div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const percentUsed = budget.percentUsed || (budget.limitAmount > 0 ? ((budget.spent || 0) / budget.limitAmount) * 100 : 0)
  const progressInfo = getBudgetProgressInfo(percentUsed)
  const isPaused = (budget as any).status === 'paused'
  const remaining = budget.remaining || budget.limitAmount - (budget.spent || 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/budgets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Wallet className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{budget.name}</h1>
              {isPaused && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  Paused
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground capitalize">{budget.period} budget</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePause} className="gap-2">
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Progress Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Budget Usage</span>
                <Badge
                  variant="outline"
                  className={`${progressInfo.variant === 'danger' ? 'bg-red-500/10 text-red-500 border-red-500/20' : progressInfo.variant === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
                >
                  {progressInfo.status}
                </Badge>
              </div>
              <Progress value={Math.min(percentUsed, 100)} className="h-4 mb-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">${(budget.spent || 0).toFixed(2)} spent</span>
                <span className="text-muted-foreground">${budget.limitAmount.toFixed(2)} limit</span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg min-w-[150px]">
              <span className="text-4xl font-bold">{percentUsed.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">used</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Limit</p>
                <p className="text-2xl font-bold text-foreground">${budget.limitAmount.toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-2xl font-bold text-foreground">${(budget.spent || 0).toFixed(2)}</p>
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
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-foreground">${remaining.toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="text-2xl font-bold text-foreground capitalize">{budget.period}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Budget Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Scope</span>
              <Badge variant="outline" className="capitalize">{budget.scope || 'user'}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium capitalize">{budget.period}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Alert Thresholds</span>
              <div className="flex gap-1">
                {(budget.alertThresholds || [80]).map((threshold, i) => (
                  <Badge key={i} variant="outline">{typeof threshold === 'number' && threshold < 1 ? `${threshold * 100}%` : `${threshold}%`}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(budget.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Usage Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage ? (
              <>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Current Spend</span>
                  <span className="font-medium">${(usage.currentSpend || 0).toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium">${(usage.remaining || 0).toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Percent Used</span>
                  <span className="font-medium">{(usage.percentUsed || 0).toFixed(2)}%</span>
                </div>
                {usage.circuitBreaker && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Circuit Breaker</span>
                    <Badge
                      variant="outline"
                      className={usage.circuitBreaker.state === 'open' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}
                    >
                      {usage.circuitBreaker.state}
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No detailed usage data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{budget.name}"?
              This action cannot be undone and will remove all associated alerts and rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBudget.isPending}
            >
              {deleteBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
