"use client"

import { useEffect, useRef } from "react"

interface Star {
  x: number
  y: number
  z: number
  pz: number
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

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
        })
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX - canvas.width / 2) * 0.05,
        y: (e.clientY - canvas.height / 2) * 0.05,
      }
    }

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width / 2 + mouseRef.current.x
      const cy = canvas.height / 2 + mouseRef.current.y

      for (const star of stars) {
        star.pz = star.z
        star.z -= speed

        if (star.z <= 0) {
          star.x = Math.random() * canvas.width - canvas.width / 2
          star.y = Math.random() * canvas.height - canvas.height / 2
          star.z = canvas.width
          star.pz = star.z
        }

        const sx = (star.x / star.z) * canvas.width + cx
        const sy = (star.y / star.z) * canvas.height + cy
        const px = (star.x / star.pz) * canvas.width + cx
        const py = (star.y / star.pz) * canvas.height + cy

        const size = (1 - star.z / canvas.width) * 3
        const alpha = (1 - star.z / canvas.width) * 0.8

        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.lineWidth = size
        ctx.moveTo(px, py)
        ctx.lineTo(sx, sy)
        ctx.stroke()

        ctx.beginPath()
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }

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
