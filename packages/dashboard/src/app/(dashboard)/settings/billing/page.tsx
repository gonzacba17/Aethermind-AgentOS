"use client"

// [B2B BETA] Billing page disabled — full Stripe billing UI commented out below.
// To restore: uncomment the original component and remove the placeholder.

// ─── Original billing page (commented out, not deleted) ───
// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import { ArrowLeft, CreditCard, Check, Zap, Building2, Loader2, ExternalLink } from "lucide-react"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Progress } from "@/components/ui/progress"
// import { useToast } from "@/hooks/use-toast"
// import { getAuthToken } from "@/lib/auth-utils"
// ... (full original billing component was here)

import { ArrowLeft, CreditCard } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function BillingPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10">
            <CreditCard className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing</h1>
            <p className="text-muted-foreground">Manage your subscription and usage</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Beta Program</CardTitle>
          <CardDescription>
            Billing is not active during the closed beta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your account is part of the Aethermind closed B2B beta.
            Billing and plan management will be available when the platform launches publicly.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
