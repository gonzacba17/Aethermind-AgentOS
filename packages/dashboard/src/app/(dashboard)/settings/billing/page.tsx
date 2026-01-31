"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CreditCard, Check, Zap, Building2, Loader2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { getAuthToken } from "@/lib/auth-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      '3 AI agents',
      '100 executions/month',
      '30 days log retention',
      'Community support',
    ],
    limits: {
      agents: 3,
      executions: 100,
      logRetention: 30,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'month',
    description: 'For growing teams',
    features: [
      'Unlimited agents',
      '10,000 executions/month',
      '90 days log retention',
      'Priority support',
      'Advanced analytics',
      'Custom alerts',
    ],
    limits: {
      agents: -1,
      executions: 10000,
      logRetention: 90,
    },
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    period: 'month',
    description: 'For large organizations',
    features: [
      'Everything in Pro',
      'Unlimited executions',
      '365 days log retention',
      'Dedicated support',
      'SSO & SAML',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: {
      agents: -1,
      executions: -1,
      logRetention: 365,
    },
  },
]

// Mock current subscription
const mockSubscription = {
  plan: 'free',
  status: 'active',
  usage: {
    agents: 2,
    executions: 45,
  },
}

export default function BillingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isManaging, setIsManaging] = useState(false)

  const currentPlan = plans.find(p => p.id === mockSubscription.plan) || plans[0]

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive",
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleManageSubscription = async () => {
    setIsManaging(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open billing portal",
        variant: "destructive",
      })
    } finally {
      setIsManaging(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10">
            <CreditCard className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing</h1>
            <p className="text-muted-foreground">Manage your subscription and usage</p>
          </div>
        </div>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription</CardDescription>
            </div>
            {mockSubscription.plan !== 'free' && (
              <Button variant="outline" onClick={handleManageSubscription} disabled={isManaging}>
                {isManaging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Manage Subscription
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              {currentPlan.id === 'enterprise' ? (
                <Building2 className="h-8 w-8 text-primary" />
              ) : (
                <Zap className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{currentPlan.name}</h3>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Active
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {currentPlan.price === 0 ? 'Free forever' : `$${currentPlan.price}/${currentPlan.period}`}
              </p>
            </div>
          </div>

          {/* Usage */}
          <div className="space-y-4">
            <h4 className="font-medium">Current Usage</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Agents</span>
                  <span className="text-sm font-medium">
                    {mockSubscription.usage.agents} / {currentPlan.limits.agents === -1 ? 'Unlimited' : currentPlan.limits.agents}
                  </span>
                </div>
                {currentPlan.limits.agents !== -1 && (
                  <Progress value={(mockSubscription.usage.agents / currentPlan.limits.agents) * 100} className="h-2" />
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Executions</span>
                  <span className="text-sm font-medium">
                    {mockSubscription.usage.executions} / {currentPlan.limits.executions === -1 ? 'Unlimited' : currentPlan.limits.executions}
                  </span>
                </div>
                {currentPlan.limits.executions !== -1 && (
                  <Progress value={(mockSubscription.usage.executions / currentPlan.limits.executions) * 100} className="h-2" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = plan.id === mockSubscription.plan
              const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === mockSubscription.plan)

              return (
                <div
                  key={plan.id}
                  className={`relative p-6 rounded-lg border-2 ${
                    plan.popular
                      ? 'border-primary'
                      : isCurrent
                      ? 'border-emerald-500'
                      : 'border-border'
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="outline" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      Current Plan
                    </Badge>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      {plan.price > 0 && <span className="text-muted-foreground">/{plan.period}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                    disabled={isCurrent || isUpgrading}
                    onClick={() => isUpgrade && handleUpgrade(plan.id)}
                  >
                    {isCurrent ? (
                      'Current Plan'
                    ) : isUpgrading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isUpgrade ? (
                      'Upgrade'
                    ) : (
                      'Downgrade'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
