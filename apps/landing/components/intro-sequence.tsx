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
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8])
  const y = useTransform(scrollYProgress, [0, 0.5], [0, -100])
  const letterSpacing = useTransform(scrollYProgress, [0, 0.3], [0, 20])

  return (
    <div ref={containerRef} className="relative min-h-[120vh]">
      <motion.div
        style={{ opacity, scale, y }}
        className="sticky top-0 flex min-h-screen flex-col items-center justify-center px-4"
      >
        <motion.div className="text-center">
          <motion.h1
            style={{ letterSpacing }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
          >
            <span className="bg-gradient-to-r from-white via-neutral-300 to-neutral-600 bg-clip-text text-transparent">
              Control Your AI Costs.
            </span>
            <br />
            <span className="text-white">
              Ship Faster.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-lg md:text-xl text-neutral-400 mb-8 max-w-2xl mx-auto font-light"
          >
            The only platform that shows AI costs{" "}
            <span className="text-white font-medium">before</span>{" "}
            execution
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
          >
            <a 
              href="/signup"
              className="group px-8 py-4 bg-white text-black rounded-full font-semibold hover:scale-105 transition-all duration-300 flex flex-col items-center"
            >
              <span>Get Started</span>
              <span className="text-neutral-600 text-sm">100 executions/month</span>
            </a>
            
            <a
              href="/docs"
              className="px-8 py-4 border border-neutral-700 text-white rounded-full font-semibold hover:bg-white/5 hover:border-white/20 backdrop-blur-sm transition-all duration-300"
            >
              Read Documentation
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 1 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500 mb-12"
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white" />
              <span>2 min setup</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-white to-transparent" />
            <span className="text-sm text-neutral-500">Scroll para explorar</span>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
