"use client"

import { motion } from "framer-motion"
import Link from "next/link"

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/docs/api" },
    { label: "Changelog", href: "/changelog" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "GitHub", href: "https://github.com/aethermind/agentos" },
    { label: "Status", href: "https://status.aethermind.com" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Security", href: "/security" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-neutral-900 bg-black">
      
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        <div className="col-span-1 md:col-span-1">
          <h3 className="text-xl font-bold tracking-widest text-white mb-4">AETHERMIND</h3>
          <p className="text-base md:text-lg text-neutral-400 leading-relaxed max-w-xs">
            AI orchestration platform for teams that care about costs.
          </p>
        </div>

        {Object.entries(footerLinks).map(([category, links]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              {category}
            </h3>
            <ul className="space-y-3">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-neutral-600">© 2025 AETHERMIND. All rights reserved.</p>
          
          <div className="flex items-center gap-6">
            <a
              href="https://twitter.com/aethermind"
              className="text-neutral-500 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sr-only">Twitter</span>
              𝕏
            </a>
            <a
              href="https://github.com/aethermind/agentos"
              className="text-sm text-neutral-500 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/aethermind"
              className="text-sm text-neutral-500 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
