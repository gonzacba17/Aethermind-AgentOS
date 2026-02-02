"use client"

import { motion } from "framer-motion"
import { DollarSign, Network, BarChart3, Shield, Users, Zap } from "lucide-react"

const capabilities = [
  {
    icon: DollarSign,
    title: "Cost Estimation",
    description: "Know what your AI will cost before you run it. Set budgets and get alerts.",
  },
  {
    icon: Network,
    title: "Multi-Agent Workflows",
    description: "Orchestrate multiple AI models working together in complex pipelines.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track executions, costs, and performance metrics via WebSocket updates.",
  },
  {
    icon: Shield,
    title: "JWT Authentication",
    description: "Production-ready auth with email verification and password reset.",
  },
  {
    icon: Users,
    title: "Usage Limits",
    description: "Automatic enforcement of plan limits. Free, Starter, Pro, Enterprise.",
  },
  {
    icon: Zap,
    title: "Task Queue",
    description: "BullMQ with Redis for reliable background job processing.",
  },
]

export function CapacidadesSection() {
  return (
    <section className="relative py-32 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">CAPACIDADES</h2>
          <p className="mt-3 text-sm tracking-[0.3em] text-neutral-500 uppercase">Sistemas de próxima generación</p>
        </motion.div>

        {/* Grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability, index) => (
            <motion.div
              key={capability.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <capability.icon className="mb-4 h-8 w-8 text-neutral-500 transition-colors group-hover:text-white" />
              <h3 className="mb-2 text-lg font-semibold text-white">{capability.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{capability.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
