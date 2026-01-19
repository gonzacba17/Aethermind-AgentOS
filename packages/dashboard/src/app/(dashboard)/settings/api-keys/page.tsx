"use client"

import { useState } from "react"
import { Key, Plus, Eye, EyeOff, Copy, Trash2, MoreVertical, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface ApiKey {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'cohere' | 'custom';
  maskedKey: string;
  status: 'active' | 'expired' | 'invalid';
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', prefix: 'sk-' },
  { value: 'anthropic', label: 'Anthropic', prefix: 'sk-ant-' },
  { value: 'cohere', label: 'Cohere', prefix: '' },
  { value: 'custom', label: 'Custom', prefix: '' },
]

// Mock data
const MOCK_KEYS: ApiKey[] = [
  {
    id: '1',
    name: 'Production OpenAI',
    provider: 'openai',
    maskedKey: 'sk-***************abcd',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    usageCount: 15420,
  },
  {
    id: '2',
    name: 'Development Anthropic',
    provider: 'anthropic',
    maskedKey: 'sk-ant-***************efgh',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastUsed: new Date(Date.now() - 3600000).toISOString(),
    usageCount: 3250,
  },
]

export default function ApiKeysPage() {
  const { toast } = useToast()
  
  // State
  const [keys, setKeys] = useState<ApiKey[]>(MOCK_KEYS)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  
  const [newKey, setNewKey] = useState({
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
    
    setIsAdding(true)
    try {
      // TODO: Call API to add key
      await new Promise(r => setTimeout(r, 1000))
      
      const key: ApiKey = {
        id: Date.now().toString(),
        name: newKey.name,
        provider: newKey.provider as any,
        maskedKey: newKey.apiKey.slice(0, 5) + '***************' + newKey.apiKey.slice(-4),
        status: 'active',
        createdAt: new Date().toISOString(),
        usageCount: 0,
      }
      
      setKeys(prev => [...prev, key])
      setIsAddOpen(false)
      setNewKey({ name: '', provider: 'openai', apiKey: '' })
      toast({
        title: "API Key Added",
        description: `${newKey.name} has been added successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add API key",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }
  
  const handleDelete = async () => {
    if (!keyToDelete) return
    
    try {
      await new Promise(r => setTimeout(r, 500))
      setKeys(prev => prev.filter(k => k.id !== keyToDelete.id))
      setIsDeleteOpen(false)
      setKeyToDelete(null)
      toast({
        title: "API Key Deleted",
        description: `${keyToDelete.name} has been deleted`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      })
    }
  }
  
  const confirmDelete = (key: ApiKey) => {
    setKeyToDelete(key)
    setIsDeleteOpen(true)
  }
  
  const copyKey = (key: ApiKey) => {
    navigator.clipboard.writeText(key.maskedKey)
    toast({
      title: "Copied",
      description: "API key copied to clipboard (note: only masked version is copied for security)",
    })
  }
  
  const toggleShowKey = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }))
  }
  
  const getStatusColor = (status: ApiKey['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'expired': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'invalid': return 'bg-red-500/10 text-red-500 border-red-500/20'
      default: return ''
    }
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
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add API Key
        </Button>
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
              API keys are encrypted at rest and only the last 4 characters are visible. 
              Never share your full API keys with anyone.
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
                        <Badge variant="outline" className={`text-xs ${getStatusColor(key.status)}`}>
                          {key.status}
                        </Badge>
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
                      <p className="text-sm font-medium">{key.usageCount.toLocaleString()} calls</p>
                      <p className="text-xs text-muted-foreground">
                        {key.lastUsed 
                          ? `Last used ${new Date(key.lastUsed).toLocaleDateString()}`
                          : 'Never used'
                        }
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "Edit functionality will be available soon" })}>
                          Edit Name
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "Key rotation will be available soon" })}>
                          Rotate Key
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
              Add a new API key to use with your agents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input 
                id="keyName"
                placeholder="e.g., Production OpenAI"
                value={newKey.name}
                onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select 
                value={newKey.provider} 
                onValueChange={(value) => setNewKey(prev => ({ ...prev, provider: value }))}
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
              <Label htmlFor="apiKey">API Key</Label>
              <Input 
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={newKey.apiKey}
                onChange={(e) => setNewKey(prev => ({ ...prev, apiKey: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted and stored securely
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isAdding}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
