"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Wallet, Plus, Search, Filter, MoreVertical, DollarSign, TrendingUp, AlertTriangle, Pause, Play, Trash2, Eye, Settings, Loader2, RefreshCw, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"
import { useBudgets, useCreateBudget, useDeleteBudget, usePauseBudget, getBudgetProgressInfo, type Budget, type CreateBudgetData } from "@/hooks/api/useBudget"

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

const SCOPES = [
  { value: 'user', label: 'User' },
  { value: 'team', label: 'Team' },
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'global', label: 'Global' },
] as const

interface BudgetFormData {
  name: string;
  limitAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  scope: string;
  hardLimit: boolean;
  alertAt: number;
}

const defaultFormData: BudgetFormData = {
  name: '',
  limitAmount: 100,
  period: 'monthly',
  scope: 'user',
  hardLimit: true,
  alertAt: 80,
}

export default function BudgetsPage() {
  const router = useRouter()
  const { toast } = useToast()

  // API hooks
  const { data: budgets = [], isLoading, error, refetch } = useBudgets()
  const createBudget = useCreateBudget()
  const deleteBudget = useDeleteBudget()
  const pauseBudget = usePauseBudget()

  // UI State
  const [searchQuery, setSearchQuery] = useState("")
  const [periodFilter, setPeriodFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null)
  const [formData, setFormData] = useState<BudgetFormData>(defaultFormData)

  // Filtered budgets
  const filteredBudgets = useMemo(() => {
    let result = [...budgets]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(b => b.name.toLowerCase().includes(query))
    }

    if (periodFilter.length > 0) {
      result = result.filter(b => periodFilter.includes(b.period))
    }

    return result
  }, [budgets, searchQuery, periodFilter, statusFilter])

  // Stats
  const totalBudget = budgets.reduce((sum, b) => sum + b.limitAmount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0)
  const totalRemaining = budgets.reduce((sum, b) => sum + (b.remaining || b.limitAmount - (b.spent || 0)), 0)
  const activeBudgets = budgets.length

  const hasActiveFilters = periodFilter.length > 0 || statusFilter.length > 0

  // Handlers
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Budget name is required",
        variant: "destructive",
      })
      return
    }

    if (formData.limitAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Limit amount must be greater than 0",
        variant: "destructive",
      })
      return
    }

    try {
      await createBudget.mutateAsync({
        name: formData.name,
        limitAmount: formData.limitAmount,
        period: formData.period,
        scope: formData.scope as any,
        alertThresholds: [formData.alertAt / 100],
      })

      setIsCreateOpen(false)
      setFormData(defaultFormData)
      toast({
        title: "Budget Created",
        description: `${formData.name} has been created successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create budget",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!budgetToDelete) return

    try {
      await deleteBudget.mutateAsync(budgetToDelete.id)
      setIsDeleteOpen(false)
      setBudgetToDelete(null)
      toast({
        title: "Budget Deleted",
        description: `${budgetToDelete.name} has been deleted.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete budget",
        variant: "destructive",
      })
    }
  }

  const handlePause = async (budget: Budget) => {
    const isPaused = (budget as any).status === 'paused'
    try {
      await pauseBudget.mutateAsync({ id: budget.id, paused: !isPaused })
      toast({
        title: isPaused ? "Budget Resumed" : "Budget Paused",
        description: `${budget.name} has been ${isPaused ? 'resumed' : 'paused'}.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update budget",
        variant: "destructive",
      })
    }
  }

  const confirmDelete = (budget: Budget) => {
    setBudgetToDelete(budget)
    setIsDeleteOpen(true)
  }

  const clearFilters = () => {
    setPeriodFilter([])
    setStatusFilter([])
    setSearchQuery("")
  }

  const togglePeriodFilter = (period: string) => {
    setPeriodFilter(prev =>
      prev.includes(period)
        ? prev.filter(p => p !== period)
        : [...prev, period]
    )
  }

  // Loading state
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
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Wallet className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
            <p className="text-muted-foreground">Manage your AI spending limits</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load budgets</div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Wallet className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
            <p className="text-muted-foreground">Manage your AI spending limits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Budget
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold text-foreground">${totalBudget.toFixed(2)}</p>
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
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">${totalSpent.toFixed(2)}</p>
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
                <p className="text-2xl font-bold text-foreground">${totalRemaining.toFixed(2)}</p>
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
                <p className="text-sm text-muted-foreground">Active Budgets</p>
                <p className="text-2xl font-bold text-foreground">{activeBudgets}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search budgets..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {periodFilter.length + statusFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Period</DropdownMenuLabel>
            {PERIODS.map(period => (
              <DropdownMenuCheckboxItem
                key={period.value}
                checked={periodFilter.includes(period.value)}
                onCheckedChange={() => togglePeriodFilter(period.value)}
              >
                {period.label}
              </DropdownMenuCheckboxItem>
            ))}
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-muted-foreground">
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Budgets List */}
      <Card>
        <CardHeader>
          <CardTitle>All Budgets</CardTitle>
          <CardDescription>
            {filteredBudgets.length} of {budgets.length} budget{budgets.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredBudgets.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No budgets found"
              description={budgets.length === 0 ? "Create your first budget to start tracking AI costs" : "No budgets match your filters"}
              actionLabel={budgets.length === 0 ? "Create Budget" : undefined}
              onAction={budgets.length === 0 ? () => setIsCreateOpen(true) : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredBudgets.map((budget) => {
                const percentUsed = budget.percentUsed || (budget.limitAmount > 0 ? ((budget.spent || 0) / budget.limitAmount) * 100 : 0)
                const progressInfo = getBudgetProgressInfo(percentUsed)
                const isPaused = (budget as any).status === 'paused'

                return (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/budgets/${budget.id}`)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20">
                        <Wallet className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{budget.name}</h3>
                          <Badge variant="outline" className="capitalize">
                            {budget.period}
                          </Badge>
                          {isPaused && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                              Paused
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`${progressInfo.variant === 'danger' ? 'bg-red-500/10 text-red-500 border-red-500/20' : progressInfo.variant === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
                          >
                            {progressInfo.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex-1 max-w-xs">
                            <Progress value={Math.min(percentUsed, 100)} className="h-2" />
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            ${(budget.spent || 0).toFixed(2)} / ${budget.limitAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{percentUsed.toFixed(1)}% used</p>
                        <p className="text-xs text-muted-foreground">
                          ${(budget.remaining || budget.limitAmount - (budget.spent || 0)).toFixed(2)} remaining
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/budgets/${budget.id}`); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePause(budget); }}>
                            {isPaused ? (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </>
                            ) : (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-500"
                            onClick={(e) => { e.stopPropagation(); confirmDelete(budget); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Budget Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>
              Set up a spending limit for your AI operations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Budget Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly AI Budget"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limitAmount">Limit Amount ($) *</Label>
                <Input
                  id="limitAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.limitAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, limitAmount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select
                  value={formData.period}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, period: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, scope: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alertAt">Alert at (%)</Label>
                <Input
                  id="alertAt"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.alertAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, alertAt: parseInt(e.target.value) || 80 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createBudget.isPending}>
              {createBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{budgetToDelete?.name}"?
              This action cannot be undone and will remove all associated alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBudgetToDelete(null)}>
              Cancel
            </AlertDialogCancel>
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
