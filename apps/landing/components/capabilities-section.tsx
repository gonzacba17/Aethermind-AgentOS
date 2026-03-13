"use client"

import { motion } from "framer-motion"

const capabilities = [
  {
    label: "agent_tracing",
    description: "See cost, latency, and errors per agent. Not per request — per agent.",
  },
  {
    label: "byok",
    description: "Bring your own API keys. We never store or proxy your provider credentials.",
  },
  {
    label: "multi_provider",
    description: "OpenAI, Anthropic, Gemini, Groq, Cohere, LM Studio. One gateway.",
  },
  {
    label: "drop_in_replacement",
    description: "Change one line. No SDK to install. No schema changes.",
  },
  {
    label: "real_time_logs",
    description: "Every request, every token, every error. Streamed to your dashboard.",
  },
  {
    label: "workflow_grouping",
    description: "Group agents by workflow. See the full pipeline cost in one view.",
  },
]

export function CapabilitiesSection() {
  return (
    <section className="relative px-6 py-32 border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="font-mono text-xs text-white/25 uppercase tracking-[0.1em] mb-4">// capabilities</p>
          <h2
            className="font-extralight tracking-[-0.04em] text-white"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Everything your multi-agent system needs.
          </h2>
        </motion.div>

        <div className="border border-white/[0.06]">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, index) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                viewport={{ once: true }}
                className="p-8 border-b border-r border-white/[0.06] last:border-b-0 group hover:bg-white/[0.02] transition-all duration-200 hover:border-white/[0.2]"
              >
                <h3 className="font-mono text-xs text-white/30 mb-3 tracking-wide group-hover:text-white/70 transition-colors duration-200">
                  :: {cap.label}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                  {cap.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
