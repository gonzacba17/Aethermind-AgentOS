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

const ctaButton = {
  label: "Start Free",
  href: "/signup",
}

// Opcional: Selector de idioma/país (descomenta para usar)
// const languageOptions = [
//   { code: "es", label: "ES" },
//   { code: "en", label: "EN" },
// ]

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isAuthenticated, user, isLoading } = useAuth()

  const handleLogout = () => {
    authAPI.logout()
    window.location.href = '/'
  }

  // Detectar scroll para cambiar el estilo del header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Prevenir scroll cuando el menú móvil está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-black/80 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-6 lg:px-8" aria-label="Navegación principal">
          <div className="flex h-20 items-center justify-between">
            {/* ============================================
                LOGO - Clickable hacia home
                ============================================ */}
            <Link
              href="/"
              className="group flex items-center transition-opacity hover:opacity-70"
              aria-label="Ir a inicio"
            >
              <motion.span
                className="text-xl font-bold tracking-widest text-white"
                whileHover={{ letterSpacing: "0.2em" }}
                transition={{ duration: 0.3 }}
              >
                AETHERMIND
              </motion.span>
            </Link>

            <div className="hidden items-center space-x-8 lg:flex">
              {navigationLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-sm text-neutral-400 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              {/* Auth Section - Desktop */}
              {!isLoading && (
                isAuthenticated && user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-400">
                      {user.name}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="px-6 py-2 bg-white/10 text-white rounded-full text-sm font-semibold hover:bg-white/20 transition-all"
                    >
                      Logout
                    </button>
                    <Link
                      href={config.dashboardUrl}
                      className="px-6 py-2 bg-white text-black rounded-full text-sm font-semibold hover:scale-105 transition-transform"
                    >
                      Dashboard
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="px-6 py-2 bg-white text-black rounded-full text-sm font-semibold hover:scale-105 transition-transform"
                  >
                    Sign In
                  </Link>
                )
              )}
            </div>

            {/* ============================================
                BOTÓN HAMBURGUESA (MÓVIL)
                ============================================ */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex flex-col items-center justify-center space-y-1.5 lg:hidden focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black p-2"
              aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={isMobileMenuOpen}
            >
              <motion.span
                animate={isMobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                className="h-0.5 w-6 bg-white transition-all"
              />
              <motion.span
                animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="h-0.5 w-6 bg-white transition-all"
              />
              <motion.span
                animate={isMobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                className="h-0.5 w-6 bg-white transition-all"
              />
            </button>
          </div>
        </nav>
      </motion.header>

      {/* ============================================
          MENÚ MÓVIL (DRAWER)
          ============================================ */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-black border-l border-white/10 lg:hidden"
            >
              <div className="flex h-full flex-col">
                {/* Header del drawer */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
                  <span className="text-lg font-bold tracking-widest text-white">MENÚ</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-white hover:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Cerrar menú"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Links de navegación */}
                <nav className="flex-1 overflow-y-auto px-6 py-8" aria-label="Navegación móvil">
                  <ul className="space-y-1">
                    {navigationLinks.map((link, index) => (
                      <motion.li
                        key={link.label}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block border-b border-white/5 py-4 text-lg tracking-wide text-neutral-300 transition-colors hover:text-white focus:text-white focus:outline-none"
                        >
                          {link.label}
                        </Link>
                      </motion.li>
                    ))}
                    
                    {/* Auth Section - Mobile */}
                    {!isLoading && (
                      isAuthenticated && user ? (
                        <>
                          <motion.li
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: navigationLinks.length * 0.05 }}
                          >
                            <Link
                              href={config.dashboardUrl}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="block border-b border-white/5 py-4 text-lg tracking-wide text-neutral-300 transition-colors hover:text-white focus:text-white focus:outline-none"
                            >
                              Dashboard
                            </Link>
                          </motion.li>
                          <motion.li
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (navigationLinks.length + 1) * 0.05 }}
                          >
                            <div className="border-b border-white/5 py-4">
                              <div className="text-sm text-neutral-500 mb-2">Logged in as</div>
                              <div className="text-white mb-3">{user.name}</div>
                              <button
                                onClick={() => {
                                  setIsMobileMenuOpen(false);
                                  handleLogout();
                                }}
                                className="w-full px-6 py-2 bg-white/10 text-white rounded-full text-sm font-semibold hover:bg-white/20 transition-all"
                              >
                                Logout
                              </button>
                            </div>
                          </motion.li>
                        </>
                      ) : (
                        <motion.li
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: navigationLinks.length * 0.05 }}
                        >
                          <Link
                            href="/login"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block border-b border-white/5 py-4 text-lg tracking-wide text-neutral-300 transition-colors hover:text-white focus:text-white focus:outline-none"
                          >
                            Sign In
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
