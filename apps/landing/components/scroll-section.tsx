"use client"

import type React from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

interface ScrollSectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  direction?: "left" | "right"
}

export function ScrollSection({ title, subtitle, children, direction = "left" }: ScrollSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  const x = useTransform(scrollYProgress, [0, 1], direction === "left" ? [-100, 0] : [100, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0.5])

  return (
    <section ref={containerRef} className="relative py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div style={{ opacity }} className="mb-20 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{title}</h2>
          {subtitle && <p className="mt-4 text-sm tracking-[0.2em] text-neutral-500 uppercase">{subtitle}</p>}
        </motion.div>
        <motion.div style={{ x, opacity }}>{children as any}</motion.div>
      </div>
    </section>
  )
}
