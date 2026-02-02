"use client"

import { motion } from "framer-motion"
import { Shield, DollarSign, Users, Zap, Lock } from "lucide-react"

const tools = [
  { icon: Shield, label: "JWT Auth" },
  { icon: DollarSign, label: "Cost Track" },
  { icon: Users, label: "Multi-tenant" },
  { icon: Zap, label: "BullMQ" },
  { icon: Lock, label: "Rate Limit" },
]

export function FloatingToolbar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="flex justify-center gap-8 sm:gap-12"
    >
      {tools.map((tool, index) => (
        <motion.button
          key={tool.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.1 }}
          className="group flex flex-col items-center gap-3"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-600 bg-transparent transition-all duration-300 group-hover:border-white/60 group-hover:bg-white/5 sm:h-20 sm:w-20">
            <tool.icon className="h-6 w-6 text-neutral-400 transition-colors group-hover:text-white sm:h-7 sm:w-7" />
          </div>
          <span className="text-xs tracking-widest text-neutral-500 transition-colors group-hover:text-white">
            {tool.label}
          </span>
        </motion.button>
      ))}
    </motion.div>
  )
}
