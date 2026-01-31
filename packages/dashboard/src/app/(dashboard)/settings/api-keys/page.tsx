"use client"

import { useState } from "react"
import { Key, Plus, Eye, EyeOff, Copy, Trash2, MoreVertical, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useUserApiKeys, useAddApiKey, useDeleteApiKey, useValidateApiKey, type UserApiKey, type AddApiKeyData } from "@/hooks/api/useUserApiKeys"

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', prefix: 'sk-' },
  { value: 'anthropic', label: 'Anthropic', prefix: 'sk-ant-' },
  { value: 'cohere', label: 'Cohere', prefix: '' },
  { value: 'google', label: 'Google AI', prefix: '' },
  { value: 'azure', label: 'Azure OpenAI', prefix: '' },
  { value: 'custom', label: 'Custom', prefix: '' },
] as const

export default function ApiKeysPage() {
  const { toast } = useToast()

  // API hooks
  const { data: keys = [], isLoading, error, refetch } = useUserApiKeys()
  const addApiKey = useAddApiKey()
  const deleteApiKey = useDeleteApiKey()
  const validateApiKey = useValidateApiKey()

  // UI State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<UserApiKey | null>(null)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [validatingKey, setValidatingKey] = useState<string | null>(null)

  const [newKey, setNewKey] = useState<AddApiKeyData>({
    name: '',
    provider: 'openai',
    apiKey: '',
  })

  // Handlers
  const handleAdd = async () => {
    if (!newKey.name.trim() || !newKey.apiKey.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and API key are required",
        variant: "destructive",
      })
      return
    }

    try {
      await addApiKey.mutateAsync(newKey)
      setIsAddOpen(false)
      setNewKey({ name: '', provider: 'openai', apiKey: '' })
      toast({
        title: "API Key Added",
        description: `${newKey.name} has been added and validated successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add API key",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!keyToDelete) return

    try {
      await deleteApiKey.mutateAsync(keyToDelete.id)
      setIsDeleteOpen(false)
      setKeyToDelete(null)
      toast({
        title: "API Key Deleted",
        description: `${keyToDelete.name} has been deleted`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      })
    }
  }

  const handleValidate = async (key: UserApiKey) => {
    setValidatingKey(key.id)
    try {
      const result = await validateApiKey.mutateAsync(key.id)
      toast({
        title: result.valid ? "Key Valid" : "Key Invalid",
        description: result.valid
          ? `${key.name} is valid and working`
          : result.error || "The API key could not be validated",
        variant: result.valid ? "default" : "destructive",
      })
    } catch (error) {
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate key",
        variant: "destructive",
      })
    } finally {
      setValidatingKey(null)
    }
  }

  const confirmDelete = (key: UserApiKey) => {
    setKeyToDelete(key)
    setIsDeleteOpen(true)
  }

  const copyKey = (key: UserApiKey) => {
    navigator.clipboard.writeText(key.maskedKey)
    toast({
      title: "Copied",
      description: "Masked key copied to clipboard (full key is not accessible for security)",
    })
  }

  const toggleShowKey = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusBadge = (key: UserApiKey) => {
    if (key.isValid) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
        Invalid
      </Badge>
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
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Key className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-muted-foreground">Manage your AI provider API keys</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load API keys</div>
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
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Key className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-muted-foreground">Manage your AI provider API keys</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add API Key
          </Button>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="border-amber-500/50">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h4 className="font-medium text-amber-500">Security Notice</h4>
            <p className="text-sm text-muted-foreground mt-1">
              API keys are encrypted at rest using AES-256-CBC and only the last 4 characters are visible.
              Keys are validated with the provider before being stored.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {keys.length} key{keys.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg">No API keys configured</h3>
              <p className="text-muted-foreground">Add your first API key to start using AI models</p>
              <Button className="mt-4 gap-2" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{key.name}</h3>
                        <Badge variant="outline" className="text-xs capitalize">
                          {key.provider}
                        </Badge>
                        {getStatusBadge(key)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-muted-foreground font-mono">
                          {showKey[key.id] ? key.maskedKey : '•'.repeat(24)}
                        </code>
                        <button
                          onClick={() => toggleShowKey(key.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showKey[key.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyKey(key)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                      {key.lastValidated && (
                        <p className="text-xs text-muted-foreground">
                          Validated {new Date(key.lastValidated).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleValidate(key)}
                          disabled={validatingKey === key.id}
                        >
                          {validatingKey === key.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 mr-2" />
                          )}
                          Validate Key
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-500"
                          onClick={() => confirmDelete(key)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Key Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new API key to use with your agents. The key will be validated with the provider before being stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name *</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production OpenAI"
                value={newKey.name}
                onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Provider *</Label>
              <Select
                value={newKey.provider}
                onValueChange={(value) => setNewKey(prev => ({ ...prev, provider: value as AddApiKeyData['provider'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={PROVIDERS.find(p => p.value === newKey.provider)?.prefix || 'Enter your API key'}
                value={newKey.apiKey}
                onChange={(e) => setNewKey(prev => ({ ...prev, apiKey: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Your API key will be encrypted with AES-256-CBC and validated before storage
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addApiKey.isPending}>
              {addApiKey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{keyToDelete?.name}"?
              This will revoke access for any agents using this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKeyToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteApiKey.isPending}
            >
              {deleteApiKey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
