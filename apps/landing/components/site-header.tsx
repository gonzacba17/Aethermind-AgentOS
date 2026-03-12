"use client"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { authAPI } from "@/lib/api/auth"
import { config } from "@/lib/config"

const navigationLinks = [
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/aethermind/agentos", external: true },
]

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isAuthenticated, user, isLoading } = useAuth()

  const handleLogout = () => {
    authAPI.logout()
    window.location.href = "/"
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset"
    return () => { document.body.style.overflow = "unset" }
  }, [isMobileMenuOpen])

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-black/90 backdrop-blur-md border-b border-white/[0.06]"
            : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-[1200px] px-10" aria-label="Main navigation">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="transition-opacity hover:opacity-70">
              <span className="font-mono text-sm font-medium tracking-[0.2em] text-white">
                AETHERMIND
              </span>
            </Link>

            <div className="hidden items-center gap-8 lg:flex">
              {navigationLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="font-mono text-xs tracking-wide text-white/40 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              {!isLoading && (
                isAuthenticated && user ? (
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-white/40">{user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="font-mono text-xs px-4 py-2 border border-white/[0.15] text-white hover:border-white/30 transition-colors"
                    >
                      logout()
                    </button>
                    <Link
                      href={config.dashboardUrl}
                      className="font-mono text-xs px-4 py-2 bg-white text-black hover:bg-white/90 transition-colors"
                    >
                      dashboard()
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="font-mono text-xs px-5 py-2 border border-white/[0.15] text-white hover:border-white/30 transition-colors"
                  >
                    sign_in()
                  </Link>
                )
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex flex-col items-center justify-center gap-1.5 lg:hidden p-2"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              <motion.span animate={isMobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }} className="h-px w-5 bg-white" />
              <motion.span animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }} className="h-px w-5 bg-white" />
              <motion.span animate={isMobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }} className="h-px w-5 bg-white" />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/80 lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-black border-l border-white/[0.06] lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
                  <span className="font-mono text-xs tracking-[0.2em] text-white/40">MENU</span>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-white/40 hover:text-white">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <nav className="flex-1 px-6 py-8">
                  <ul className="space-y-1">
                    {navigationLinks.map((link, index) => (
                      <motion.li key={link.label} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                        <Link
                          href={link.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block border-b border-white/[0.06] py-4 font-mono text-sm text-white/40 hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      </motion.li>
                    ))}
                    {!isLoading && (
                      isAuthenticated && user ? (
                        <>
                          <motion.li initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: navigationLinks.length * 0.05 }}>
                            <Link href={config.dashboardUrl} onClick={() => setIsMobileMenuOpen(false)} className="block border-b border-white/[0.06] py-4 font-mono text-sm text-white/40 hover:text-white">
                              Dashboard
                            </Link>
                          </motion.li>
                          <motion.li initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (navigationLinks.length + 1) * 0.05 }}>
                            <div className="border-b border-white/[0.06] py-4">
                              <div className="font-mono text-xs text-white/20 mb-2">Logged in as</div>
                              <div className="text-white mb-3 text-sm">{user.name}</div>
                              <button onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="w-full font-mono text-xs py-2 border border-white/[0.15] text-white hover:border-white/30 transition-colors">
                                logout()
                              </button>
                            </div>
                          </motion.li>
                        </>
                      ) : (
                        <motion.li initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: navigationLinks.length * 0.05 }}>
                          <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block border-b border-white/[0.06] py-4 font-mono text-sm text-white/40 hover:text-white">
                            sign_in()
                          </Link>
                        </motion.li>
                      )
                    )}
                  </ul>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
