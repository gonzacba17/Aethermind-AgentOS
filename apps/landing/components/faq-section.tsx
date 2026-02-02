"use client"

import { motion } from "framer-motion"
import { Plus, Minus } from "lucide-react"
import { useState } from "react"

const faqs = [
  {
    question: "What LLM providers do you support?",
    answer: "We support all major providers: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), and Ollama for local models. You can use multiple providers in the same workflow."
  },
  {
    question: "How does cost prediction work?",
    answer: "Our engine analyzes your workflow, estimates token usage based on input/output patterns, and calculates costs using real-time provider pricing. You see the estimate before execution—no surprises."
  },
  {
    question: "Can I try it for free?",
    answer: "Yes! Our Free tier includes 100 executions/month, 3 agents, and 1 workflow—forever. No credit card required. Upgrade anytime as you scale."
  },
  {
    question: "What happens if I exceed my plan limit?",
    answer: "Executions are automatically paused when you hit your limit. You'll get alerts at 80% and 100% usage. Simply upgrade your plan to continue, or wait for the monthly reset."
  },
  {
    question: "Do you offer self-hosted deployment?",
    answer: "Yes, Enterprise plans include self-hosted options with Docker Compose or Kubernetes. You maintain full control over your data and infrastructure."
  },
  {
    question: "How is this different from LangChain?",
    answer: "LangChain is a dev framework. AethermindOS is a complete platform with cost tracking, usage limits, authentication, real-time monitoring, and a dashboard. Think of us as the production layer on top."
  }
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-3xl mx-auto w-full">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Questions?
          </h2>
          <p className="text-xl text-neutral-400">
            Everything you need to know about AethermindOS
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full text-left p-6 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all duration-300 bg-transparent"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">
                    {faq.question}
                  </h3>
                  <div className="flex-shrink-0">
                    {openIndex === index ? (
                      <Minus className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <Plus className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                </div>
                
                {openIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 text-neutral-400 leading-relaxed"
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-neutral-500">
            Still have questions?{" "}
            <a href="/contact" className="text-white hover:underline">
              Contact our team
            </a>
          </p>
        </motion.div>

      </div>
    </section>
  )
}
