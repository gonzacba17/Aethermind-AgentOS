'use client'
import { useRouter } from 'next/navigation'

const plans = [
  {
    id: 'trial',
    name: 'Trial',
    price: 0,
    period: '14 days',
    features: ['Gateway access', '10k requests', 'Basic analytics', 'No credit card required'],
    cta: 'start_free()',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    period: '/month',
    features: ['100k requests/month', 'Agent tracing', 'Multi-provider routing', 'Email support'],
    cta: 'get_started()',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    period: '/month',
    features: ['500k requests/month', 'Agent tracing', 'Budget controls', 'Ollama support'],
    cta: 'get_started()',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 149,
    period: '/month',
    features: ['Unlimited requests', 'Priority support', 'Custom models', 'Advanced analytics'],
    cta: 'get_started()',
  },
]

export default function OnboardingPricing() {
  const router = useRouter()

  const handleSelectPlan = (planId: string) => {
    const onboardingData = {
      selectedPlan: planId,
      timestamp: Date.now(),
      completed: true,
    }
    localStorage.setItem('onboarding_payment', JSON.stringify(onboardingData))
    localStorage.setItem('onboarding_marketing_seen', 'true')
    router.push('/onboarding/setup')
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 h-px bg-white/[0.06] z-50">
        <div className="h-full bg-white" style={{ width: '80%' }} />
      </div>
      <div className="fixed top-3 left-6 font-mono text-xs text-white/20 z-50">
        // step_04 — pricing
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-5xl w-full py-16">
          <h2
            className="font-light tracking-[-0.04em] text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            Simple pricing. No surprises.
          </h2>
          <p className="text-[1.1rem] font-light text-white/40 mb-12">
            BYOK — you pay your provider directly. We charge for the gateway.
          </p>

          <div className="border border-white/[0.06]">
            <div className="grid md:grid-cols-4">
              {plans.map((plan, index) => (
                <div
                  key={plan.id}
                  className={`p-8 flex flex-col ${
                    index > 0 ? 'md:border-l border-t md:border-t-0 border-white/[0.06]' : ''
                  } hover:bg-white/[0.02] transition-colors`}
                >
                  <h3 className="font-mono text-sm text-white mb-6">{plan.name}</h3>

                  <div className="mb-6">
                    <span className="text-4xl font-light tracking-[-0.04em] text-white">${plan.price}</span>
                    <span className="text-sm text-white/20 ml-2">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="text-sm text-white/40 flex items-start gap-2">
                        <span className="text-white/20">—</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    className="w-full font-mono text-xs py-2.5 border border-white/[0.15] text-white hover:bg-white hover:text-black transition-colors"
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 font-mono text-xs text-white/20 flex flex-wrap items-center justify-center gap-4">
            <span>// cancel anytime</span>
            <span>·</span>
            <span>// no setup fees</span>
            <span>·</span>
            <span>// byok — your keys, your data</span>
          </div>
        </div>
      </div>
    </div>
  )
}
