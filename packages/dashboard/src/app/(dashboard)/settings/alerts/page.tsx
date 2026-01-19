"use client"

import { useState } from "react"
import { 
  Bell, Plus, Trash2, Settings, AlertTriangle, DollarSign, Zap, 
  Activity, MoreVertical, CheckCircle2, XCircle, Clock, RefreshCw,
  Loader2, ToggleLeft, ToggleRight, Mail, Webhook, BellRing, PauseCircle
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { 
  useAlerts, 
  useCreateAlert, 
  useDeleteAlert, 
  useToggleAlert,
  getOperatorLabel,
  getAlertTypeColor,
  Alert,
  CreateAlertData
} from "@/hooks/api/useAlerts"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

const ALERT_TYPES = [
  { value: 'budget', label: 'Budget', icon: DollarSign, description: 'Monitor spending thresholds' },
  { value: 'usage', label: 'Usage', icon: Activity, description: 'Track API usage limits' },
  { value: 'error', label: 'Error', icon: XCircle, description: 'Alert on error rates' },
  { value: 'performance', label: 'Performance', icon: Zap, description: 'Monitor response times' },
]

const METRICS = {
  budget: [
    { value: 'monthly_cost', label: 'Monthly Cost ($)' },
    { value: 'daily_cost', label: 'Daily Cost ($)' },
    { value: 'budget_percent', label: 'Budget Usage (%)' },
  ],
  usage: [
    { value: 'daily_requests', label: 'Daily Requests' },
    { value: 'daily_tokens', label: 'Daily Tokens' },
    { value: 'active_agents', label: 'Active Agents' },
  ],
  error: [
    { value: 'error_rate', label: 'Error Rate (%)' },
    { value: 'error_count', label: 'Error Count' },
    { value: 'failed_traces', label: 'Failed Traces' },
  ],
  performance: [
    { value: 'avg_response_time', label: 'Avg Response Time (ms)' },
    { value: 'p95_response_time', label: 'P95 Response Time (ms)' },
    { value: 'queue_size', label: 'Queue Size' },
  ],
}

const OPERATORS = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater or equal', symbol: '≥' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less or equal', symbol: '≤' },
  { value: 'eq', label: 'Equal to', symbol: '=' },
]

const ACTION_TYPES = [
  { value: 'notification', label: 'In-app Notification', icon: BellRing },
  { value: 'email', label: 'Email Alert', icon: Mail },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
  { value: 'pause_agent', label: 'Pause Agent', icon: PauseCircle },
]

interface CreateAlertFormData {
  name: string;
  type: 'budget' | 'usage' | 'error' | 'performance';
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  actions: string[];
}

const defaultFormData: CreateAlertFormData = {
  name: '',
  type: 'budget',
  metric: 'monthly_cost',
  operator: 'gt',
  threshold: 100,
  actions: ['notification'],
}

export default function AlertsPage() {
  const { toast } = useToast()
  
  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [alertToDelete, setAlertToDelete] = useState<Alert | null>(null)
  const [formData, setFormData] = useState<CreateAlertFormData>(defaultFormData)
  
  // Data fetching
  const { data: alerts, isLoading, error, refetch } = useAlerts()
  const createAlert = useCreateAlert()
  const deleteAlert = useDeleteAlert()
  const toggleAlert = useToggleAlert()
  
  // Stats
  const enabledCount = alerts?.filter(a => a.enabled).length || 0
  const triggeredCount = alerts?.filter(a => a.triggerCount > 0).length || 0
  const totalTriggers = alerts?.reduce((sum, a) => sum + a.triggerCount, 0) || 0
  
  // Handlers
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Alert name is required",
        variant: "destructive",
      })
      return
    }
    
    try {
      const data: CreateAlertData = {
        name: formData.name,
        type: formData.type,
        condition: {
          metric: formData.metric,
          operator: formData.operator,
          threshold: formData.threshold,
        },
        actions: formData.actions.map(a => ({ type: a as any, config: {} })),
      }
      
      await createAlert.mutateAsync(data)
      setIsCreateOpen(false)
      setFormData(defaultFormData)
      toast({
        title: "Alert Created",
        description: `${formData.name} has been created`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create alert",
        variant: "destructive",
      })
    }
  }
  
  const handleDelete = async () => {
    if (!alertToDelete) return
    
    try {
      await deleteAlert.mutateAsync(alertToDelete.id)
      setIsDeleteOpen(false)
      setAlertToDelete(null)
      toast({
        title: "Alert Deleted",
        description: `${alertToDelete.name} has been deleted`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete alert",
        variant: "destructive",
      })
    }
  }
  
  const handleToggle = async (alert: Alert) => {
    try {
      await toggleAlert.mutateAsync({ id: alert.id, enabled: !alert.enabled })
      toast({
        title: alert.enabled ? "Alert Disabled" : "Alert Enabled",
        description: `${alert.name} has been ${alert.enabled ? 'disabled' : 'enabled'}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle alert",
        variant: "destructive",
      })
    }
  }
  
  const confirmDelete = (alert: Alert) => {
    setAlertToDelete(alert)
    setIsDeleteOpen(true)
  }
  
  const getTypeIcon = (type: Alert['type']) => {
    const config = ALERT_TYPES.find(t => t.value === type)
    return config?.icon || Bell
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
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
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <Bell className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
            <p className="text-muted-foreground">Configure monitoring and notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Alert
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-foreground">{enabledCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Triggered Today</p>
                <p className="text-2xl font-bold text-foreground">{triggeredCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Triggers</p>
                <p className="text-2xl font-bold text-foreground">{totalTriggers}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Bell className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
          <CardDescription>
            {alerts?.length || 0} alert{alerts?.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!alerts || alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No alerts configured"
              description="Create your first alert to start monitoring"
              actionLabel="Create Alert"
              onAction={() => setIsCreateOpen(true)}
            />
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const TypeIcon = getTypeIcon(alert.type)
                const typeColor = getAlertTypeColor(alert.type)
                
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      alert.enabled ? 'bg-card' : 'bg-muted/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${alert.enabled ? 'bg-amber-500/10' : 'bg-muted'}`}>
                        <TypeIcon className={`h-5 w-5 ${alert.enabled ? typeColor : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{alert.name}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {alert.type}
                          </Badge>
                          {!alert.enabled && (
                            <Badge variant="secondary" className="text-xs">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.condition.metric} {getOperatorLabel(alert.condition.operator)} {alert.condition.threshold}
                          {alert.condition.timeWindow && ` (${alert.condition.timeWindow})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {alert.triggerCount > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium">{alert.triggerCount} triggers</p>
                          <p className="text-xs text-muted-foreground">
                            Last: {alert.lastTriggered 
                              ? new Date(alert.lastTriggered).toLocaleDateString()
                              : 'Never'
                            }
                          </p>
                        </div>
                      )}
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={() => handleToggle(alert)}
                        disabled={toggleAlert.isPending}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "Edit functionality will be available soon" })}>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "View history will be available soon" })}>
                            <Clock className="h-4 w-4 mr-2" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-500 focus:text-red-500"
                            onClick={() => confirmDelete(alert)}
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

      {/* Create Alert Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Alert</DialogTitle>
            <DialogDescription>
              Configure conditions and actions for your alert
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Alert Name *</Label>
              <Input 
                id="name"
                placeholder="e.g., Budget Warning" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Alert Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALERT_TYPES.map(type => {
                  const Icon = type.icon
                  const isSelected = formData.type === type.value
                  return (
                    <button
                      key={type.value}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        type: type.value as any,
                        metric: METRICS[type.value as keyof typeof METRICS][0].value
                      }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-medium">{type.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select 
                  value={formData.metric} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, metric: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS[formData.type].map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select 
                  value={formData.operator} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, operator: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.symbol} {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input 
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Actions</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACTION_TYPES.map(action => {
                  const Icon = action.icon
                  const isSelected = formData.actions.includes(action.value)
                  return (
                    <button
                      key={action.value}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        actions: isSelected 
                          ? prev.actions.filter(a => a !== action.value)
                          : [...prev.actions, action.value]
                      }))}
                      className={`p-2 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                        isSelected 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm">{action.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createAlert.isPending}>
              {createAlert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{alertToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAlert.isPending}
            >
              {deleteAlert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
