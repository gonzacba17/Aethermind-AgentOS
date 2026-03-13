"use client"

import Link from "next/link"
import { useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

const steps = [
  {
    num: "// 01",
    title: "Point to the gateway",
    description: "Change your baseURL. Your existing OpenAI code works unchanged.",
    code: `const openai = new OpenAI({
  baseURL: 'https://aethermind-agentos-production.up.railway.app/gateway/v1',
  apiKey: process.env.OPENAI_API_KEY,
});`,
  },
  {
    num: "// 02",
    title: "Authenticate",
    description: "Add your client token to the request headers.",
    code: `defaultHeaders: {
  'X-Client-Token': process.env.AETHERMIND_TOKEN,
}`,
  },
  {
    num: "// 03",
    title: "Add agent context",
    description: "Add three headers to track each agent individually.",
    code: `defaultHeaders: {
  'X-Client-Token': process.env.AETHERMIND_TOKEN,
  'X-Agent-Id':     'research-agent',
  'X-Agent-Name':   'ResearchAgent',
  'X-Workflow-Id':  'content-pipeline',
}`,
  },
]

const referenceCards = [
  { title: "API Reference", description: "Full endpoint and header documentation." },
  { title: "Agent Tracing", description: "How to identify and group agents." },
  { title: "Multi-Provider", description: "Supported providers and configuration." },
  { title: "BYOK Setup", description: "How to configure your provider API keys." },
  { title: "Error Handling", description: "Status codes, retry logic, fallbacks." },
  { title: "Examples", description: "Real-world multi-agent pipeline examples." },
]

function ReferenceCard({ title, description }: { title: string; description: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`border p-8 transition-colors duration-200 ${
        hovered ? "border-white/[0.15]" : "border-white/[0.06]"
      }`}
    >
      <h3 className="text-white font-normal mb-2">{title}</h3>
      <p className="text-white/40 font-light text-sm leading-relaxed">{description}</p>
    </div>
  )
}

export default function DocsPage() {
  return (
    <main className="relative min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="py-32 px-6">
        <div className="max-w-[1200px] mx-auto">

          {/* ── Hero ── */}
          <div className="mb-24">
            <p className="font-mono text-white/25 uppercase tracking-[0.1em] text-sm mb-6">
              // documentation
            </p>
            <h1
              className="font-extralight text-white mb-6"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.1 }}
            >
              Everything you need to get started.
            </h1>
            <p className="text-white/50 font-light text-lg max-w-xl">
              Aethermind is a drop-in OpenAI replacement. No SDK required.
            </p>
          </div>

          {/* ── Quickstart ── */}
          <div className="border-t border-white/[0.06]">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="grid grid-cols-1 md:grid-cols-[2fr_3fr] border-b border-white/[0.06]"
              >
                {/* Left — text */}
                <div className="py-12 pr-8 md:pr-12">
                  <span className="font-mono text-white/25 text-[3rem] leading-none block mb-6">
                    {step.num}
                  </span>
                  <h2 className="text-white text-xl font-light mb-3">{step.title}</h2>
                  <p className="text-white/50 font-light text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Right — code */}
                <div className="md:border-l border-white/[0.06] py-12 md:pl-12">
                  <pre className="bg-[#030305] p-6 overflow-x-auto">
                    <code className="font-mono text-[0.8rem] text-white/70 leading-relaxed whitespace-pre">
                      {step.code}
                    </code>
                  </pre>
                </div>
              </div>
            ))}

            {/* Step 4 — no code block */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] border-b border-white/[0.06]">
              <div className="py-12 pr-8 md:pr-12">
                <span className="font-mono text-white/25 text-[3rem] leading-none block mb-6">
                  // 04
                </span>
                <h2 className="text-white text-xl font-light mb-3">Open your dashboard</h2>
                <p className="text-white/50 font-light text-sm leading-relaxed">
                  Every agent appears with its own trace: cost, latency, model, errors.
                </p>
              </div>
              <div className="md:border-l border-white/[0.06] py-12 md:pl-12 flex items-center">
                <Link
                  href="https://aethermind-dashboard.vercel.app"
                  className="inline-block bg-white text-black font-mono text-sm px-8 py-3 hover:bg-white/90 transition-colors"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>
          </div>

          {/* ── Reference Grid ── */}
          <div className="mt-24 mb-8">
            <p className="font-mono text-white/25 uppercase tracking-[0.1em] text-sm mb-16">
              // reference
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {referenceCards.map((card) => (
                <ReferenceCard key={card.title} title={card.title} description={card.description} />
              ))}
            </div>
          </div>

        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
