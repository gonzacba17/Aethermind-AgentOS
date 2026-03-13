"use client"

import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

const steps = [
  {
    label: "change_base_url()",
    description: "Point to the Aethermind gateway. Your existing OpenAI code works unchanged.",
  },
  {
    label: "add_three_headers()",
    description: "X-Agent-Id, X-Agent-Name, X-Workflow-Id. That's the entire integration.",
  },
  {
    label: "see_every_agent()",
    description: "Cost, latency, model, tokens, errors — per agent, per workflow, in real-time.",
  },
]

const codeSnippet = `const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://aethermind-agentos-production.up.railway.app/gateway/v1',
  defaultHeaders: {
    'X-Client-Token': process.env.AETHERMIND_TOKEN,
    'X-Agent-Id':     'research-agent',
    'X-Agent-Name':   'ResearchAgent',
    'X-Workflow-Id':  'content-pipeline',
  }
});`

function TypewriterCode({ code, className }: { code: string; className?: string }) {
  const containerRef = useRef<HTMLPreElement>(null)
  const hasPlayedRef = useRef(false)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayedRef.current) {
          hasPlayedRef.current = true
          setIsTyping(true)

          let i = 0
          const interval = setInterval(() => {
            i++
            setDisplayedText(code.slice(0, i))
            if (i >= code.length) {
              clearInterval(interval)
              setIsTyping(false)
              setIsDone(true)
            }
          }, 30)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [code])

  return (
    <pre ref={containerRef} className="p-6 overflow-x-auto">
      <code className={className}>
        {isDone ? code : displayedText}
        {isTyping && <span className="animate-pulse">|</span>}
      </code>
    </pre>
  )
}

export function HowItWorks() {
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
          <p className="font-mono text-xs text-white/25 uppercase tracking-[0.1em] mb-4">// how_it_works</p>
          <h2
            className="font-extralight tracking-[-0.04em] text-white mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Three headers. Full visibility.
          </h2>
          <p className="text-[1.1rem] font-light text-white/50 max-w-2xl leading-relaxed">
            Add agent context to every request. See each agent individually in your dashboard.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="mb-16 border border-white/[0.06] bg-[#030305]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="font-mono text-xs text-white/20">integration.ts</span>
            <button
              className="font-mono text-xs text-white/20 hover:text-white/40 transition-colors"
              onClick={() => navigator.clipboard?.writeText(codeSnippet)}
            >
              copy
            </button>
          </div>
          <TypewriterCode
            code={codeSnippet}
            className="font-mono text-sm text-white/70 leading-relaxed whitespace-pre"
          />
        </motion.div>

        <div className="grid md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`p-8 border-t border-white/[0.06] ${
                index > 0 ? "md:border-l" : ""
              } group hover:bg-white/[0.02] transition-colors`}
            >
              <h3 className="font-mono text-xs text-white mb-4 tracking-wide">
                {step.label}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
