"use client"

import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { ArrowLeft, Palette, Sun, Moon, Monitor, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const themes = [
  {
    value: 'light',
    label: 'Light',
    description: 'A clean, bright theme',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easy on the eyes',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow your device settings',
    icon: Monitor,
  },
]

export default function AppearancePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    toast({
      title: "Theme Updated",
      description: `Theme changed to ${newTheme}`,
    })
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Palette className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Appearance</h1>
            <p className="text-muted-foreground">Customize the look and feel of the dashboard</p>
          </div>
        </div>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((t) => {
              const Icon = t.icon
              const isSelected = theme === t.value

              return (
                <button
                  key={t.value}
                  onClick={() => handleThemeChange(t.value)}
                  className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 p-1 rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className="font-medium">{t.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>See how your selection looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 rounded-lg border bg-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">A</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Aethermind AgentOS</h3>
                <p className="text-sm text-muted-foreground">Current theme: {resolvedTheme}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-primary text-primary-foreground text-center text-sm font-medium">
                Primary
              </div>
              <div className="p-3 rounded-lg bg-secondary text-secondary-foreground text-center text-sm font-medium">
                Secondary
              </div>
              <div className="p-3 rounded-lg bg-muted text-muted-foreground text-center text-sm font-medium">
                Muted
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
