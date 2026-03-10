"use client"

import Link from "next/link"
import { useTrialStatus } from "@/hooks/api/useTrial"

export function TrialBanner() {
  const { data: trial, isLoading } = useTrialStatus()

  if (isLoading || !trial) return null

  const isTrial = trial.plan === 'trial' || trial.plan === 'free'
  if (!isTrial) return null

  // Trial expired
  if (!trial.isTrialActive) {
    return (
      <div className="bg-red-600 text-white text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2">
        <span>Your trial has expired.</span>
        <Link
          href="/settings/billing"
          className="underline font-semibold hover:text-white/90"
        >
          Upgrade now
        </Link>
        <span>to continue using Aethermind.</span>
      </div>
    )
  }

  // Trial warning (3 days or less)
  if (trial.trialDaysRemaining !== null && trial.trialDaysRemaining <= 3) {
    return (
      <div className="bg-yellow-500 text-black text-sm px-4 py-2 text-center flex items-center justify-center gap-2">
        <span>
          Your trial expires in {trial.trialDaysRemaining} day{trial.trialDaysRemaining !== 1 ? 's' : ''}.
        </span>
        <Link
          href="/settings/billing"
          className="underline font-semibold hover:text-black/80"
        >
          Upgrade now
        </Link>
      </div>
    )
  }

  return null
}
