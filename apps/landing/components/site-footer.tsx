"use client"

import Link from "next/link"

const footerLinks = {
  Product: [
    { label: "Pricing", href: "/#pricing" },
    { label: "Docs", href: "/docs" },
    { label: "Sign In", href: "/login" },
  ],
  Developers: [
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/docs/api" },
    { label: "Quickstart", href: "/#quickstart" },
  ],
  Company: [
    { label: "GitHub", href: "https://github.com/aethermind/agentos" },
    { label: "Contact", href: "/contact" },
  ],
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-black">
      <div className="max-w-[1200px] mx-auto px-10 pt-20 pb-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <h3 className="font-mono text-xs tracking-[0.2em] text-white mb-4">AETHERMIND</h3>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs">
            The AI Gateway built for multi-agent systems.
          </p>
        </div>

        {Object.entries(footerLinks).map(([category, links]) => (
          <div key={category}>
            <h3 className="font-mono text-xs tracking-[0.1em] text-white/25 mb-4 uppercase">
              {category}
            </h3>
            <ul className="space-y-3">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-mono text-xs text-white/20">&copy; 2025 Aethermind. All rights reserved.</p>
          <a
            href="https://github.com/aethermind/agentos"
            className="font-mono text-xs text-white/20 hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
