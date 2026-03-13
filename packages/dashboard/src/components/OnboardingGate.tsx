'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

/**
 * Renders the OnboardingWizard dialog when the authenticated user
 * has not completed onboarding. Sits inside AuthGuard (client is guaranteed).
 *
 * - onComplete: user finished all steps → DB updated, store updated, wizard gone permanently
 * - onClose (X button): user dismissed → wizard hidden for this session only, reappears on F5
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const client = useAuthStore((s) => s.client);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const [dismissed, setDismissed] = useState(false);

  if (!client) return <>{children}</>;

  const needsOnboarding = !client.hasCompletedOnboarding && !dismissed;

  return (
    <>
      {children}
      <OnboardingWizard
        open={needsOnboarding}
        onClose={() => setDismissed(true)}
        onComplete={() => setOnboardingComplete()}
      />
    </>
  );
}
