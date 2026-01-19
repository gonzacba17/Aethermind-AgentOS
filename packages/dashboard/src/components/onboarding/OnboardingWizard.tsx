"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Rocket, Key, Bot, DollarSign, CheckCircle2, ChevronRight, 
  ChevronLeft, Sparkles, Loader2, X
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  { 
    id: 'welcome', 
    title: 'Welcome to Aethermind', 
    icon: Sparkles,
    description: 'Let\'s get you started with AI agent orchestration'
  },
  { 
    id: 'api-key', 
    title: 'Connect Your API Key', 
    icon: Key,
    description: 'Add an API key to power your AI agents'
  },
  { 
    id: 'agent', 
    title: 'Create Your First Agent', 
    icon: Bot,
    description: 'Set up an AI agent to automate tasks'
  },
  { 
    id: 'budget', 
    title: 'Set a Budget', 
    icon: DollarSign,
    description: 'Control your AI spending with budget limits'
  },
  { 
    id: 'complete', 
    title: 'You\'re All Set!', 
    icon: CheckCircle2,
    description: 'Start building with Aethermind'
  },
]

export function OnboardingWizard({ open, onClose, onComplete }: OnboardingWizardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Form data
  const [apiKeyData, setApiKeyData] = useState({ provider: 'openai', key: '' })
  const [agentData, setAgentData] = useState({ name: 'My First Agent', model: 'gpt-4' })
  const [budgetData, setBudgetData] = useState({ limit: 100, period: 'monthly' })
  
  const progress = ((currentStep + 1) / STEPS.length) * 100
  const step = STEPS[currentStep]
  const StepIcon = step.icon
  
  const handleNext = async () => {
    // Validate current step
    if (currentStep === 1 && !apiKeyData.key) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to continue",
        variant: "destructive",
      })
      return
    }
    
    if (currentStep === 2 && !agentData.name) {
      toast({
        title: "Agent Name Required",
        description: "Please enter a name for your agent",
        variant: "destructive",
      })
      return
    }
    
    // If on last step, complete onboarding
    if (currentStep === STEPS.length - 1) {
      setIsLoading(true)
      try {
        // TODO: Call API to save onboarding data
        await new Promise(r => setTimeout(r, 1000))
        onComplete()
        toast({
          title: "🎉 Welcome to Aethermind!",
          description: "Your account is ready to use",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to complete onboarding",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
      return
    }
    
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }
  
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }
  
  const handleSkip = () => {
    if (currentStep === STEPS.length - 1) return
    setCurrentStep(prev => prev + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header with progress */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-lg font-semibold">Getting Started</DialogTitle>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className={`p-4 rounded-2xl bg-primary/10 mb-4 ${currentStep === STEPS.length - 1 ? 'bg-emerald-500/10' : ''}`}>
              <StepIcon className={`h-8 w-8 ${currentStep === STEPS.length - 1 ? 'text-emerald-500' : 'text-primary'}`} />
            </div>
            <h2 className="text-xl font-bold">{step.title}</h2>
            <p className="text-muted-foreground mt-1">{step.description}</p>
          </div>

          {/* Step-specific content */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {[
                  { title: 'Create AI Agents', desc: 'Build autonomous agents that execute complex tasks' },
                  { title: 'Monitor & Debug', desc: 'Track traces, logs, and performance in real-time' },
                  { title: 'Control Costs', desc: 'Set budgets and get alerts before overspending' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select 
                  value={apiKeyData.provider} 
                  onValueChange={(v) => setApiKeyData(prev => ({ ...prev, provider: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="cohere">Cohere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input 
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyData.key}
                  onChange={(e) => setApiKeyData(prev => ({ ...prev, key: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Your API key is encrypted and stored securely. 
                  <a href="https://platform.openai.com/api-keys" target="_blank" className="text-primary ml-1 hover:underline">
                    Get OpenAI key →
                  </a>
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Agent Name</Label>
                <Input 
                  placeholder="My First Agent"
                  value={agentData.name}
                  onChange={(e) => setAgentData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select 
                  value={agentData.model} 
                  onValueChange={(v) => setAgentData(prev => ({ ...prev, model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4 (Most capable)</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</SelectItem>
                    <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Monthly Budget Limit ($)</Label>
                <Input 
                  type="number"
                  value={budgetData.limit}
                  onChange={(e) => setBudgetData(prev => ({ ...prev, limit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border">
                <h4 className="font-medium mb-1">Budget Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start small and increase as needed</li>
                  <li>• You'll get alerts at 50%, 80%, and 100%</li>
                  <li>• You can always adjust your budget later</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <h4 className="font-medium text-emerald-500 mb-2">Setup Complete!</h4>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>API Key configured</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>First agent created: {agentData.name}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Budget set: ${budgetData.limit}/month</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={handleBack} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button onClick={handleNext} disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentStep === STEPS.length - 1 ? (
                <>
                  <Rocket className="h-4 w-4" />
                  Get Started
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
