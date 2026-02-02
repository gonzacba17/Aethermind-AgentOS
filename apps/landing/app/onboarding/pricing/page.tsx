'use client'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export default function OnboardingPricing() {
  const router = useRouter()

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 29,
      description: 'Perfect for small teams',
      features: ['1,000 executions/month', 'Real-time cost tracking', 'Email support', 'Basic analytics'],
      highlighted: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 99,
      description: 'For growing companies',
      features: ['10,000 executions/month', 'Advanced optimization', 'Priority support', 'Custom models', 'API access'],
      highlighted: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: null,
      description: 'For large organizations',
      features: ['Unlimited executions', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'White-label option'],
      highlighted: false
    }
  ]

  const handleSelectPlan = (planId: string) => {
    // Save selected plan to localStorage with timestamp
    const onboardingData = {
      selectedPlan: planId,
      timestamp: Date.now(),
      completed: true
    }
    localStorage.setItem('onboarding_payment', JSON.stringify(onboardingData))

    // Mark marketing onboarding as seen
    localStorage.setItem('onboarding_marketing_seen', 'true')

    console.log('[Onboarding Pricing] Plan selected:', planId)

    // Redirect to setup page for API key and SDK installation
    router.push('/onboarding/setup')
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="max-w-6xl w-full space-y-12 py-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">Choose Your Plan</h2>
          <p className="text-xl text-gray-400">
            To access the dashboard and start controlling AI costs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 space-y-6 transition-all ${
                plan.highlighted 
                  ? 'border-2 border-blue-500 scale-105' 
                  : 'border border-gray-800'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              
              <div>
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
              </div>

              <div>
                {plan.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                ) : (
                  <div className="text-3xl font-bold">Custom</div>
                )}
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-white text-black hover:bg-gray-100'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {plan.price ? 'Start 7-Day Trial' : 'Contact Sales'}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              7-day money back
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              No setup fees
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
