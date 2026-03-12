"use client"

import { motion } from "framer-motion"

const problems = [
  {
    title: "Without Aethermind",
    description: "Your logs show one request. Your bill shows $47. Good luck finding which agent burned it.",
  },
  {
    title: "What teams do instead",
    description: "Add console.log everywhere. Re-run the whole pipeline. Hope the error reproduces.",
  },
  {
    title: "What this costs",
    description: "Hours debugging. Unpredictable spend. Agents you can't trust in production.",
  },
]

export function ProblemSection() {
  return (
    <section className="relative px-6 py-32">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="font-mono text-xs text-white/20 mb-4">// the_problem</p>
          <h2
            className="font-light tracking-[-0.04em] text-white mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Multi-agent systems are a black box.
          </h2>
          <p className="text-[1.1rem] font-light text-white/40 max-w-2xl leading-relaxed">
            You know your pipeline ran. You don&apos;t know which agent failed,
            what it cost, or why it slowed down. Until now.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3">
          {problems.map((problem, index) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`p-8 border-t border-white/[0.06] ${
                index > 0 ? "md:border-l" : ""
              } group hover:bg-white/[0.02] transition-colors`}
            >
              <h3 className="font-mono text-xs text-white/40 mb-4 tracking-wide">
                — {problem.title}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                {problem.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
