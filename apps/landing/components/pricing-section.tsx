"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"

export function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for testing and small projects",
      features: [
        "100 executions/month",
        "3 agents max",
        "1 workflow",
        "Community support",
        "Basic cost tracking"
      ],
      cta: "Start Free",
      href: "/signup",
      highlighted: false
    },
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "For growing teams and production use",
      features: [
        "10,000 executions/month",
        "20 agents",
        "10 workflows",
        "Email support (48h)",
        "Advanced analytics",
        "Webhook notifications"
      ],
      cta: "Start Trial",
      href: "/signup?plan=starter",
      highlighted: true
    },
    {
      name: "Pro",
      price: "$199",
      period: "/month",
      description: "For teams at scale",
      features: [
        "100,000 executions/month",
        "Unlimited agents & workflows",
        "Priority support (4h)",
        "Team collaboration",
        "Custom integrations",
        "Export data"
      ],
      cta: "Start Trial",
      href: "/signup?plan=pro",
      highlighted: false
    }
  ]

  return (
    <section id="pricing" className="relative flex items-center justify-center px-6 py-32">
      <div className="max-w-7xl mx-auto w-full">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-neutral-400">
            Start free. Scale as you grow. Cancel anytime.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`
                relative p-8 rounded-lg border transition-all duration-300
                ${plan.highlighted 
                  ? "border-white bg-white/5 scale-105" 
                  : "border-neutral-800 bg-transparent hover:border-white/20"
                }
              `}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-black text-sm font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-neutral-400">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-bold text-white">{plan.price}</span>
                <span className="text-neutral-400">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                    <span className="text-neutral-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`
                  block w-full py-3 rounded-full font-semibold text-center transition-all duration-300
                  ${plan.highlighted
                    ? "bg-white text-black hover:scale-105"
                    : "border border-neutral-700 text-white hover:bg-white/5 hover:border-white/20 backdrop-blur-sm"
                  }
                `}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 text-center text-neutral-500 text-sm"
        >
          <p>All plans include multi-provider support (OpenAI, Anthropic, Google, Ollama)</p>
          <p className="mt-2">Need more? <a href="/contact" className="text-white hover:underline">Contact us</a> for Enterprise pricing</p>
        </motion.div>

      </div>
    </section>
  )
}
