"use client"

import { motion } from "framer-motion"

const plans = [
  {
    name: "Trial",
    price: "$0",
    period: "/ 14 days",
    features: [
      "gateway access",
      "10k requests",
      "basic analytics",
      "no credit card required",
    ],
    cta: "Get Started Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "/ month",
    features: [
      "100k requests/month",
      "agent tracing",
      "multi-provider routing",
      "email support",
    ],
    cta: "Get Started",
    href: "/signup?plan=starter",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$49",
    period: "/ month",
    features: [
      "500k requests/month",
      "agent tracing",
      "budget controls",
      "Ollama support",
    ],
    cta: "Get Started",
    href: "/signup?plan=growth",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/ month",
    features: [
      "unlimited requests",
      "priority support",
      "custom models",
      "advanced analytics",
    ],
    cta: "Get Started",
    href: "/signup?plan=pro",
    highlighted: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative px-6 py-32 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="font-mono text-xs text-white/25 uppercase tracking-[0.1em] mb-4">// pricing</p>
          <h2
            className="font-extralight tracking-[-0.04em] text-white mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Simple pricing. No surprises.
          </h2>
          <p className="text-[1.1rem] font-light text-white/50 max-w-2xl leading-relaxed">
            BYOK — you pay your provider directly. We charge for the gateway.
          </p>
        </motion.div>

        <div className="border border-white/[0.06]">
          <div className="grid md:grid-cols-4">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`p-8 flex flex-col ${
                  index > 0 ? "md:border-l border-t md:border-t-0 border-white/[0.06]" : ""
                } group hover:bg-white/[0.02] transition-colors`}
              >
                <div className="mb-6">
                  <h3 className="font-mono text-sm text-white mb-1">{plan.name}</h3>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-light tracking-[-0.04em] text-white">{plan.price}</span>
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

                <a
                  href={plan.href}
                  className="block w-full text-center text-xs py-2.5 border border-white/[0.15] text-white hover:bg-white hover:text-black transition-colors"
                >
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-8 font-mono text-xs text-white/20 flex flex-wrap items-center justify-center gap-4"
        >
          <span>// cancel anytime</span>
          <span>·</span>
          <span>// no setup fees</span>
          <span>·</span>
          <span>// byok — your keys, your data</span>
        </motion.div>
      </div>
    </section>
  )
}
