'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

/**
 * Renders the OnboardingWizard dialog when the authenticated user
 * has not completed onboarding. Sits inside AuthGuard (client is guaranteed).
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const client = useAuthStore((s) => s.client);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);

  if (!client) return <>{children}</>;

  const needsOnboarding = !client.hasCompletedOnboarding;

  return (
    <>
      {children}
      <OnboardingWizard
        open={needsOnboarding}
        onClose={() => setOnboardingComplete()}
        onComplete={() => setOnboardingComplete()}
      />
    </>
  );
}
