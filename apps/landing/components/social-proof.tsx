"use client"

import { motion } from "framer-motion"
import { Quote } from "lucide-react"

export function SocialProof() {
  return (
    <section className="relative flex items-center justify-center px-6 py-32">
      <div className="max-w-5xl mx-auto w-full">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <Quote className="w-12 h-12 text-neutral-700 mx-auto mb-6" />
          
          <blockquote className="text-xl md:text-2xl font-light text-white mb-6 leading-relaxed">
            "We reduced our AI costs by{" "}
            <span className="font-bold">40% in the first month</span>{" "}
            using AethermindOS cost prediction. Game changer."
          </blockquote>
          
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700" />
            <div className="text-left">
              <p className="text-white font-medium">Alex Chen</p>
              <p className="text-sm text-neutral-500">CTO, Neural Labs AI</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          <div className="p-6 rounded-lg border border-neutral-900 bg-neutral-950/50">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">500+</div>
            <div className="text-sm text-neutral-500">AI Teams</div>
          </div>
          
          <div className="p-6 rounded-lg border border-neutral-900 bg-neutral-950/50">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">2M+</div>
            <div className="text-sm text-neutral-500">Executions</div>
          </div>
          
          <div className="p-6 rounded-lg border border-neutral-900 bg-neutral-950/50">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">$1M+</div>
            <div className="text-sm text-neutral-500">Costs Saved</div>
          </div>
          
          <div className="p-6 rounded-lg border border-neutral-900 bg-neutral-950/50">
            <div className="text-3xl md:text-4xl font-bold text-white mb-2">99.9%</div>
            <div className="text-sm text-neutral-500">Uptime</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 text-center"
        >
          <p className="text-sm text-neutral-600 mb-6 uppercase tracking-wider">
            Trusted by AI-first teams
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-40">
            <div className="text-neutral-500 font-semibold text-lg">AI Startup Co</div>
            <div className="text-neutral-500 font-semibold text-lg">Tech Agency</div>
            <div className="text-neutral-500 font-semibold text-lg">Neural Labs</div>
            <div className="text-neutral-500 font-semibold text-lg">AI Solutions</div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
