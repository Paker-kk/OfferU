// =============================================
// NextUI + SWR Provider 包装 + Onboarding 引导
// =============================================

"use client";

import { NextUIProvider } from "@nextui-org/react";
import { SWRConfig } from "swr";
import { AnimatePresence } from "framer-motion";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useOnboarding } from "@/lib/useOnboarding";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { shouldShowWizard, completeWizard, skipWizard } = useOnboarding();

  return (
    <>
      {children}
      <AnimatePresence>
        {shouldShowWizard && (
          <OnboardingWizard
            onComplete={completeWizard}
            onSkip={skipWizard}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 5000,
      }}
    >
      <NextUIProvider>
        <OnboardingGate>
          {children}
        </OnboardingGate>
      </NextUIProvider>
    </SWRConfig>
  );
}
