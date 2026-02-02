"use client"

import { motion, useInView } from "framer-motion"
import { useEffect, useRef, useState } from "react"

const terminalLines = [
  "$ aethermind init --project enterprise",
  "[OK] Conectando con núcleo de IA...",
  "[OK] Cargando modelos de lenguaje...",
  "[OK] Inicializando agentes autónomos...",
  "",
  ">>> Sistema Aethermind v3.0 listo",
  ">>> Capacidades activadas:",
  "    - Generación de código inteligente",
  "    - Análisis predictivo empresarial",
  "    - Protección cibernética adaptativa",
  "",
  "$ estado del sistema",
  "[INFO] CPU: 12% | Memoria: 2.4GB | GPU: NVIDIA A100",
  "[INFO] Latencia: 23ms | Uptime: 99.97%",
  "",
  ">>> Esperando instrucciones...",
]

export function TerminalDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "-100px" })
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [currentLine, setCurrentLine] = useState(0)

  useEffect(() => {
    if (!isInView) return

    if (currentLine < terminalLines.length) {
      const timer = setTimeout(() => {
        const line = terminalLines[currentLine]
        if (line !== undefined) {
          setDisplayedLines((prev) => [...prev, line])
        }
        setCurrentLine((prev) => prev + 1)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isInView, currentLine])

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        viewport={{ once: true }}
        className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-neutral-600" />
          <div className="h-3 w-3 rounded-full bg-neutral-500" />
          <div className="h-3 w-3 rounded-full bg-neutral-400" />
          <span className="ml-4 text-sm text-neutral-500">aethermind-terminal</span>
        </div>

        <div className="h-96 overflow-auto p-4 font-mono text-sm">
          {displayedLines.map((line, i) => {
            if (!line) return <div key={i} className="h-4" />

            const safeReplace = (str: string, search: string, replacement: string) => {
              return str ? str.replace(search, replacement) : str
            }

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${
                  line.startsWith("$")
                    ? "text-white"
                    : line.startsWith("[OK]")
                      ? "text-neutral-300"
                      : line.startsWith("[INFO]")
                        ? "text-neutral-400"
                        : line.startsWith(">>>")
                          ? "text-neutral-200"
                          : "text-neutral-500"
                }`}
              >
                {line.startsWith("$") ? (
                  <>
                    <span className="text-white">$</span>
                    {safeReplace(line, "$", "")}
                  </>
                ) : (
                  line
                )}
              </motion.div>
            )
          })}
          {currentLine < terminalLines.length && <span className="inline-block h-4 w-2 animate-pulse bg-white" />}
        </div>
      </motion.div>
    </div>
  )
}
