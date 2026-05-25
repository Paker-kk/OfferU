// =============================================
// NextUI + SWR Provider 包装 + Onboarding 引导
// =============================================

"use client";

import { NextUIProvider } from "@nextui-org/react";
import { SWRConfig } from "swr";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { HarnessAgentDock } from "@/components/ai/HarnessAgentDock";
import { ProfileAgentDock } from "@/components/ai/ProfileAgentDock";
import { useOnboarding } from "@/lib/useOnboarding";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");

const PAGE_TITLES: Record<string, string> = {
  "/": "仪表盘",
  "/scraper": "抓取器",
  "/jobs": "岗位库",
  "/optimize": "AI 优化",
  "/resume": "简历",
  "/applications": "投递",
  "/interview": "面试",
  "/calendar": "日程",
  "/email": "邮件",
  "/analytics": "分析",
  "/agent": "助手",
  "/profile": "档案",
  "/settings": "设置",
};

function inferPageTitle(pathname: string) {
  if (/^\/jobs\/\d+/.test(pathname)) return "岗位详情";
  if (/^\/resume\/\d+/.test(pathname)) return "简历详情";
  return PAGE_TITLES[pathname] || "OfferU 页面";
}

function inferEntity(pathname: string) {
  const jobMatch = pathname.match(/^\/jobs\/(\d+)/);
  if (jobMatch) return { entity_type: "job", entity_id: jobMatch[1] };
  const resumeMatch = pathname.match(/^\/resume\/(\d+)/);
  if (resumeMatch) return { entity_type: "resume", entity_id: resumeMatch[1] };
  return { entity_type: "", entity_id: "" };
}

function AgentContextReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    const entity = inferEntity(pathname);
    fetch(`${API_BASE}/api/agent/context`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "default",
        route: pathname,
        title: inferPageTitle(pathname),
        entity_type: entity.entity_type,
        entity_id: entity.entity_id,
        context: {
          reported_at: new Date().toISOString(),
        },
        updated_by: "ui",
      }),
      signal: controller.signal,
    }).catch(() => {
      // Context sync should never block the user's UI flow.
    });
    return () => controller.abort();
  }, [pathname]);

  return null;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { shouldShowWizard, completeWizard, skipWizard } = useOnboarding();
  const pathname = usePathname();
  const canShowWizard = pathname === "/";

  return (
    <>
      {children}
      <AnimatePresence>
        {shouldShowWizard && canShowWizard && (
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
  const pathname = usePathname();
  const isProfilePage = pathname === "/profile";

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 5000,
      }}
    >
      <NextUIProvider>
        <AgentContextReporter />
        <OnboardingGate>
          {children}
          {isProfilePage ? <ProfileAgentDock /> : <HarnessAgentDock />}
        </OnboardingGate>
      </NextUIProvider>
    </SWRConfig>
  );
}
