"use client"

import { motion } from "framer-motion"

const codeLines = [
  { text: "import", color: "text-neutral-400" },
  { text: " { AethermindClient }", color: "text-white" },
  { text: " from", color: "text-neutral-400" },
  { text: " '@aethermind/sdk'", color: "text-neutral-300" },
]

const codeBlock = `
const client = new AethermindClient({
  apiKey: process.env.AETHERMIND_API_KEY
})

// Estimate cost before execution
const estimate = await client.workflows.estimate('content-generator')
console.log(\`Estimated cost: \${estimate.cost}\`)

// Execute workflow
const result = await client.workflows.execute('content-generator', {
  topic: 'AI orchestration'
})
`

export function IdeMockup() {
  return (
    <div className="relative mx-auto max-w-4xl px-4">
      {/* Main IDE Window */}
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl sm:rounded-3xl">
        {/* Window Header */}
        <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-neutral-600" />
          <div className="h-3 w-3 rounded-full bg-neutral-500" />
          <div className="h-3 w-3 rounded-full bg-neutral-400" />
          <span className="ml-4 text-sm text-neutral-500">agent.ts</span>
        </div>

        {/* Code Content */}
        <div className="p-4 font-mono text-sm sm:p-6">
          <div className="flex">
            {codeLines.map((segment, i) => (
              <span key={i} className={segment.color}>
                {segment.text}
              </span>
            ))}
          </div>
          <pre className="mt-2 text-neutral-300">
            <code>{codeBlock}</code>
          </pre>
        </div>
      </div>

      {/* Floating AI Assistant Panel */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        viewport={{ once: true }}
        className="absolute -right-2 top-16 w-48 rounded-xl border border-white/20 bg-white/5 p-3 shadow-2xl backdrop-blur-xl sm:-right-4 sm:w-56 sm:rounded-2xl sm:p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="text-xs font-medium text-neutral-200">AI Assistant</span>
        </div>
        <div className="space-y-2 text-xs text-neutral-300">
          <p>Detecté una oportunidad de optimización en la línea 7.</p>
          <div className="flex gap-2">
            <button className="rounded-md bg-white/20 px-2 py-1 text-white transition-colors hover:bg-white/30">
              Aplicar
            </button>
            <button className="rounded-md bg-neutral-500/20 px-2 py-1 text-neutral-400 transition-colors hover:bg-neutral-500/30">
              Ignorar
            </button>
          </div>
        </div>
      </motion.div>

      {/* Floating Terminal Panel */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        viewport={{ once: true }}
        className="absolute -left-2 bottom-8 w-44 rounded-xl border border-white/20 bg-white/5 p-3 shadow-2xl backdrop-blur-xl sm:-left-4 sm:w-52 sm:rounded-2xl sm:p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="text-xs font-medium text-neutral-200">Terminal</span>
        </div>
        <div className="space-y-1 font-mono text-xs text-white">
          <div>$ npm run dev</div>
          <div className="text-neutral-400">▸ Ready in 1.2s</div>
          <div className="text-neutral-400">▸ Local: http://localhost:3000</div>
        </div>
      </motion.div>
    </div>
  )
}
