"use client"

import { motion } from "framer-motion"
import { DollarSign, Network, BarChart3, AlertCircle } from "lucide-react"

export function ProblemSolution() {
  return (
    <section className="relative flex items-center justify-center px-6 py-32">
      <div className="max-w-6xl mx-auto w-full">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/20 bg-red-500/5 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">The Problem</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            AI Costs Are{" "}
            <span className="text-neutral-500">Unpredictable</span>
          </h2>
          
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Most teams discover their OpenAI bill after running workflows.
            <br />
            <span className="text-white">By then, it's too late.</span>
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="group p-8 rounded-lg border border-neutral-800 bg-transparent hover:border-white/20 transition-all duration-300"
          >
            <DollarSign className="w-10 h-10 text-neutral-500 group-hover:text-white transition-colors mb-4" />
            <h3 className="text-xl font-bold mb-3 text-white">Cost Prediction</h3>
            <p className="text-neutral-400 mb-4 leading-relaxed">
              See estimated costs before execution. No surprises in your bill.
            </p>
            <div className="p-3 bg-black border border-neutral-800 rounded font-mono text-sm">
              <span className="text-neutral-500">Estimated:</span>{" "}
              <span className="text-white">$2.45</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="group p-8 rounded-lg border border-neutral-800 bg-transparent hover:border-white/20 transition-all duration-300"
          >
            <Network className="w-10 h-10 text-neutral-500 group-hover:text-white transition-colors mb-4" />
            <h3 className="text-xl font-bold mb-3 text-white">Multi-Agent Orchestration</h3>
            <p className="text-neutral-400 mb-4 leading-relaxed">
              Coordinate multiple AI models working together seamlessly.
            </p>
            <div className="flex gap-2">
              <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-400">
                GPT-4
              </div>
              <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-400">
                Claude
              </div>
              <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-400">
                Gemini
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="group p-8 rounded-lg border border-neutral-800 bg-transparent hover:border-white/20 transition-all duration-300"
          >
            <BarChart3 className="w-10 h-10 text-neutral-500 group-hover:text-white transition-colors mb-4" />
            <h3 className="text-xl font-bold mb-3 text-white">Real-time Monitoring</h3>
            <p className="text-neutral-400 mb-4 leading-relaxed">
              Track executions, logs, and traces as they happen.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-neutral-400">Live updates via WebSocket</span>
            </div>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 grid grid-cols-3 gap-8 text-center"
        >
          <div>
            <div className="text-4xl font-bold text-white mb-2">40%</div>
            <div className="text-sm text-neutral-500">Average cost savings</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">10x</div>
            <div className="text-sm text-neutral-500">Faster to production</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">100%</div>
            <div className="text-sm text-neutral-500">Cost visibility</div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
