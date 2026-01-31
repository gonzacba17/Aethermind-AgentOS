"use client"

import { useRouter } from "next/navigation"
import { Settings, Bell, User, Shield, Palette, CreditCard, ChevronRight, Key, Building2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const settingsItems = [
  {
    title: "Alerts & Notifications",
    description: "Configure budget alerts and notification preferences",
    icon: Bell,
    href: "/settings/alerts",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Profile",
    description: "Manage your account information and preferences",
    icon: User,
    href: "/settings/profile",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Organization",
    description: "Manage your team, members, and organization settings",
    icon: Building2,
    href: "/settings/organization",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "API Keys",
    description: "Manage your OpenAI, Anthropic and other API keys",
    icon: Key,
    href: "/settings/api-keys",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    title: "Security",
    description: "Password, two-factor authentication, and sessions",
    icon: Shield,
    href: "/settings/security",
    color: "text-red-500",
    bg: "bg-red-500/10",
    disabled: true,
  },
  {
    title: "Appearance",
    description: "Customize the look and feel of the dashboard",
    icon: Palette,
    href: "/settings/appearance",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Billing",
    description: "Manage your subscription and payment methods",
    icon: CreditCard,
    href: "/settings/billing",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
]

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted">
          <Settings className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsItems.map((item) => {
          const Icon = item.icon
          return (
            <Card 
              key={item.title}
              className={`cursor-pointer transition-all hover:shadow-md ${
                item.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
              }`}
              onClick={() => !item.disabled && router.push(item.href)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${item.bg}`}>
                      <Icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.disabled && (
                        <span className="text-xs text-muted-foreground mt-1 inline-block">
                          Coming soon
                        </span>
                      )}
                    </div>
                  </div>
                  {!item.disabled && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
