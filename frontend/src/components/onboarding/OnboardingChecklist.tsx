// =============================================
// OnboardingChecklist — Dashboard 内嵌引导卡片
// =============================================
// 显示在 Dashboard 顶部，根据真实数据驱动
// 完成对应任务后自动隐藏该卡片
// 全部完成后整个 Checklist 消失
// 保留「重新引导」入口
// =============================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, Button } from "@nextui-org/react";
import {
  Key,
  FileText,
  Briefcase,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useOnboarding } from "@/lib/useOnboarding";
import { useConfig, useResumes, useJobs } from "@/lib/hooks";

export function OnboardingChecklist() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const { data: config } = useConfig();
  const { data: resumes } = useResumes();
  const { data: jobsData } = useJobs({ page: 1 });

  // 同步真实数据到 onboarding 状态
  useEffect(() => {
    if (!onboarding.hydrated) return;
    const hasApiKey = !!(
      config?.deepseek_api_key ||
      config?.openai_api_key
    );
    const hasResume = Array.isArray(resumes) && resumes.length > 0;
    const hasJobs = !!(jobsData?.items && jobsData.items.length > 0);
    onboarding.syncFromData({ hasApiKey, hasResume, hasJobs });
  }, [config, resumes, jobsData, onboarding.hydrated]);

  // 全部完成或未 hydrated 则不显示
  if (!onboarding.hydrated || onboarding.allStepsCompleted) return null;

  const steps = [
    {
      key: "apikey",
      label: "配置 AI 能力",
      description: "设置 API Key 以启用 AI 简历优化与分析",
      icon: Key,
      done: onboarding.apiKeyConfigured,
      action: () => router.push("/settings"),
      actionLabel: "前往设置",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      key: "resume",
      label: "创建你的简历",
      description: "AI 优化的前提——先有一份简历",
      icon: FileText,
      done: onboarding.resumeCreated,
      action: () => router.push("/resume"),
      actionLabel: "新建简历",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      key: "jobs",
      label: "采集校招岗位",
      description: "从多平台自动采集最新岗位信息",
      icon: Briefcase,
      done: onboarding.jobsScraped,
      action: () => router.push("/scraper"),
      actionLabel: "开始采集",
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const pendingSteps = steps.filter((s) => !s.done);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-white/10">
        <CardBody className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Sparkles size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">快速开始</h3>
                <p className="text-xs text-white/40">
                  完成以下步骤，解锁 OfferU 全部功能
                </p>
              </div>
            </div>
            <div className="text-xs text-white/40">
              {completedCount}/{steps.length} 已完成
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", damping: 20 }}
            />
          </div>

          {/* Pending steps */}
          <div className="space-y-2">
            <AnimatePresence>
              {pendingSteps.map((step) => (
                <motion.div
                  key={step.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all min-h-[64px]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.bg}`}>
                      <step.icon size={16} className={step.color} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-white/30">{step.description}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    endContent={<ArrowRight size={14} />}
                    onPress={step.action}
                  >
                    {step.actionLabel}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* 已完成的步骤 — 折叠展示 */}
            {steps
              .filter((s) => s.done)
              .map((step) => (
                <div
                  key={step.key}
                  className="flex items-center gap-3 p-2 px-3 rounded-lg opacity-40"
                >
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-xs line-through">{step.label}</span>
                </div>
              ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

/** Dashboard 右上角 "快速开始" 入口 */
export function OnboardingTriggerButton() {
  const onboarding = useOnboarding();

  if (!onboarding.hydrated) return null;

  return (
    <Button
      size="sm"
      variant="flat"
      startContent={<Sparkles size={14} />}
      onPress={() => onboarding.resetWizard()}
      className="text-xs"
    >
      快速开始
    </Button>
  );
}
