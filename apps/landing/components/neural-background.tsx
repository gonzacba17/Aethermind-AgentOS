"use client"

import { useEffect, useRef } from "react"

interface Star {
  x: number
  y: number
  z: number
  pz: number
  radius: number
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const mouseScreenRef = useRef({ x: 0, y: 0 })
  const parallaxRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const stars: Star[] = []
    const numStars = 400
    const speed = 2

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const initStars = () => {
      stars.length = 0
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * canvas.width,
          pz: 0,
          radius: 1 + Math.random() * 2, // varied sizes 1-3px
        })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX - canvas.width / 2) * 0.05,
        y: (e.clientY - canvas.height / 2) * 0.05,
      }
      mouseScreenRef.current = {
        x: e.clientX,
        y: e.clientY,
      }
    }

    const animate = () => {
      // Smooth parallax interpolation
      const targetParallaxX = ((mouseScreenRef.current.x / canvas.width) - 0.5) * 30 // ±15px
      const targetParallaxY = ((mouseScreenRef.current.y / canvas.height) - 0.5) * 30
      parallaxRef.current.x += (targetParallaxX - parallaxRef.current.x) * 0.05
      parallaxRef.current.y += (targetParallaxY - parallaxRef.current.y) * 0.05

      ctx.save()
      ctx.translate(parallaxRef.current.x, parallaxRef.current.y)

      ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
      ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40)

      const cx = canvas.width / 2 + mouseRef.current.x
      const cy = canvas.height / 2 + mouseRef.current.y

      // Pre-calculate projected positions for connector lines
      const projected: { sx: number; sy: number; alpha: number }[] = []

      for (const star of stars) {
        star.pz = star.z
        star.z -= speed

        if (star.z <= 0) {
          star.x = Math.random() * canvas.width - canvas.width / 2
          star.y = Math.random() * canvas.height - canvas.height / 2
          star.z = canvas.width
          star.pz = star.z
          star.radius = 1 + Math.random() * 2
        }

        const sx = (star.x / star.z) * canvas.width + cx
        const sy = (star.y / star.z) * canvas.height + cy
        const px = (star.x / star.pz) * canvas.width + cx
        const py = (star.y / star.pz) * canvas.height + cy

        const size = (1 - star.z / canvas.width) * 3
        let alpha = (1 - star.z / canvas.width) * 0.8

        // Proximity glow — boost opacity for particles near cursor
        const dxMouse = sx - mouseScreenRef.current.x
        const dyMouse = sy - mouseScreenRef.current.y
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)
        if (distMouse < 150) {
          const boost = 1.3 + 0.2 * (1 - distMouse / 150) // 1.3 at edge, 1.5 at center
          alpha = Math.min(1, alpha * boost)
        }

        projected.push({ sx, sy, alpha })

        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.lineWidth = size
        ctx.moveTo(px, py)
        ctx.lineTo(sx, sy)
        ctx.stroke()

        ctx.beginPath()
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.arc(sx, sy, star.radius * (size * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }

      // Gradient connector lines between nearby particles
      const connectionDist = 120
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].sx - projected[j].sx
          const dy = projected[i].sy - projected[j].sy
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectionDist) {
            const grad = ctx.createLinearGradient(
              projected[i].sx, projected[i].sy,
              projected[j].sx, projected[j].sy
            )
            grad.addColorStop(0, "rgba(255, 255, 255, 0.02)")
            grad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)")
            grad.addColorStop(1, "rgba(255, 255, 255, 0.02)")

            ctx.beginPath()
            ctx.strokeStyle = grad
            ctx.lineWidth = 0.5
            ctx.moveTo(projected[i].sx, projected[i].sy)
            ctx.lineTo(projected[j].sx, projected[j].sy)
            ctx.stroke()
          }
        }
      }

      ctx.restore()

      animationId = requestAnimationFrame(animate)
    }

    resize()
    initStars()
    animate()

    window.addEventListener("resize", () => {
      resize()
      initStars()
    })
    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        background: "#000000",
        zIndex: 0
      }}
    />
  )
}
