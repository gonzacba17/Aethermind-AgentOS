"use client"

import { motion } from "framer-motion"

const steps = [
  {
    label: "// 01_install",
    title: "No SDK required",
    description: "Use your existing OpenAI client. Nothing to install — just point the baseURL.",
    code: null,
  },
  {
    label: "// 02_connect",
    title: "Connect to the gateway",
    description: "Change one line in your existing code.",
    code: `const openai = new OpenAI({
  baseURL: 'https://aethermind-agentos-production.up.railway.app/gateway/v1',
  defaultHeaders: {
    'X-Client-Token': process.env.AETHERMIND_TOKEN,
  }
});`,
  },
  {
    label: "// 03_trace",
    title: "Add agent context",
    description: "Three headers. That's the entire integration.",
    code: `defaultHeaders: {
  'X-Agent-Id':    'my-agent',
  'X-Agent-Name':  'MyAgent',
  'X-Workflow-Id': 'my-workflow',
}`,
  },
  {
    label: "// 04_done",
    title: "Open your dashboard",
    description: "See every agent, every cost, every error.",
    code: null,
  },
]

export function QuickstartSection() {
  return (
    <section id="quickstart" className="relative px-6 py-32 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="font-mono text-xs text-white/25 uppercase tracking-[0.1em] mb-4">// quickstart</p>
          <h2
            className="font-extralight tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Up and running in 5 minutes.
          </h2>
        </motion.div>

        <div className="space-y-0">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="border-t border-white/[0.06] grid md:grid-cols-2 gap-8"
            >
              <div className="py-8">
                <p className="font-mono text-xs text-white/25 uppercase tracking-[0.1em] mb-3">{step.label}</p>
                <h3 className="text-lg font-light text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.description}</p>
                {index === steps.length - 1 && (
                  <a
                    href="/signup"
                    className="inline-block mt-6 text-sm px-6 py-2.5 bg-white text-black hover:bg-white/90 transition-colors"
                  >
                    Open Dashboard
                  </a>
                )}
              </div>
              <div className="py-8">
                {step.code && (
                  <div className="border border-white/[0.06] bg-[#030305]">
                    <pre className="p-5 overflow-x-auto">
                      <code className="font-mono text-xs text-white/60 leading-relaxed whitespace-pre">
                        {step.code}
                      </code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
