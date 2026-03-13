"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

export function IntroSequence() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])
  const y = useTransform(scrollYProgress, [0, 0.5], [0, -80])

  return (
    <div ref={containerRef} className="relative min-h-[120vh]">
      <motion.div
        style={{ opacity, scale, y }}
        className="sticky top-0 flex min-h-screen flex-col items-center justify-center px-6"
      >
        <motion.div className="text-center max-w-4xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white font-extralight tracking-[-0.04em] leading-[1.05]"
            style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}
          >
            See inside your agents.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-8 text-[1.1rem] font-light text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            Know exactly which agent ran, what it cost, and why it failed.
            <br />
            Drop-in OpenAI replacement with native agent-level tracing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <a
              href="/signup"
              className="text-sm px-8 py-3 bg-white text-black hover:bg-white/90 transition-colors"
            >
              Get Started Free
            </a>
            <a
              href="/docs"
              className="text-sm px-8 py-3 border border-white/[0.15] text-white hover:border-white/30 transition-colors"
            >
              Read the Docs
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mt-6 font-mono text-xs text-white/25 flex items-center justify-center gap-4"
          >
            <span>// no credit card</span>
            <span>·</span>
            <span>// 2 min setup</span>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
