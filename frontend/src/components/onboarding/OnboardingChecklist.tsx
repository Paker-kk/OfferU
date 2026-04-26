"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  Key,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useOnboarding } from "@/lib/useOnboarding";
import { useConfig, useJobs, useResumes } from "@/lib/hooks";

export function OnboardingChecklist() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const {
    hydrated,
    allStepsCompleted,
    apiKeyConfigured,
    resumeCreated,
    jobsScraped,
    syncFromData,
  } = onboarding;
  const { data: config } = useConfig();
  const { data: resumes } = useResumes();
  const { data: jobsData } = useJobs({ page: 1 });

  useEffect(() => {
    if (!hydrated) return;

    const list = Array.isArray((config as { llm_api_configs?: unknown[] } | undefined)?.llm_api_configs)
      ? ((config as { llm_api_configs?: unknown[] }).llm_api_configs as Record<string, unknown>[])
      : [];

    const active =
      list.find((item) => item?.is_active) ||
      list.find(
        (item) =>
          item?.id ===
          (config as { active_llm_config_id?: string } | undefined)?.active_llm_config_id
      );

    const configMap = (config as Record<string, unknown> | undefined) || {};

    const hasApiKey = Boolean(
      (active &&
        (String(active.provider_id || "").toLowerCase() === "ollama" ||
          active.api_key)) ||
        configMap.deepseek_api_key ||
        configMap.openai_api_key ||
        configMap.qwen_api_key ||
        configMap.siliconflow_api_key ||
        configMap.gemini_api_key ||
        configMap.zhipu_api_key
    );

    const hasResume = Array.isArray(resumes) && resumes.length > 0;
    const hasJobs = Boolean(jobsData?.items && jobsData.items.length > 0);
    syncFromData({ hasApiKey, hasResume, hasJobs });
  }, [config, resumes, jobsData, hydrated, syncFromData]);

  if (!hydrated || allStepsCompleted) return null;

  const steps = [
    {
      key: "apikey",
      label: "配置 AI 能力",
      description: "设置 API Key，打开简历优化、分析与问答能力。",
      icon: Key,
      done: apiKeyConfigured,
      action: () => router.push("/settings"),
      actionLabel: "前往设置",
      panel: "bg-[#F0C020] text-black",
      iconBox: "bg-white text-black",
    },
    {
      key: "resume",
      label: "创建第一份简历",
      description: "先建立基础档案，后续岗位匹配和优化才有抓手。",
      icon: FileText,
      done: resumeCreated,
      action: () => router.push("/resume"),
      actionLabel: "新建简历",
      panel: "bg-white text-black",
      iconBox: "bg-[#1040C0] text-white",
    },
    {
      key: "jobs",
      label: "抓取目标岗位",
      description: "连接平台并开始同步，让首页和岗位库进入工作状态。",
      icon: Briefcase,
      done: jobsScraped,
      action: () => router.push("/scraper"),
      actionLabel: "开始抓取",
      panel: "bg-[#1040C0] text-white",
      iconBox: "bg-[#F0C020] text-black",
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const pendingSteps = steps.filter((step) => !step.done);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bauhaus-panel overflow-hidden bg-white"
    >
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b-2 border-black p-6 lg:border-b-0 lg:border-r-2 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="bauhaus-label text-black/55">Quick Start</p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] md:text-3xl">
                Build The System
              </h2>
              <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
                这不是传统意义上的欢迎卡片，而是一条明确的装配线。完成三步后，
                抓取、简历与分析模块就会进入可用状态。
              </p>
            </div>

            <div className="bauhaus-panel-sm bg-[#D02020] px-4 py-3 text-center text-white">
              <p className="bauhaus-label text-white/70">Progress</p>
              <p className="mt-1 text-2xl font-black tracking-[-0.06em]">
                {completedCount}/{steps.length}
              </p>
            </div>
          </div>

          <div className="mt-6 border-2 border-black bg-[#F0F0F0] p-1">
            <motion.div
              className="h-4 bg-[#F0C020]"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onboarding.resetWizard()}
              className="bauhaus-button bauhaus-button-yellow"
            >
              <RotateCcw size={16} strokeWidth={2.6} />
              重新引导
            </button>
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="bauhaus-button bauhaus-button-outline"
            >
              <Sparkles size={16} strokeWidth={2.6} />
              系统配置
            </button>
          </div>
        </div>

        <div className="bg-[#F0F0F0] p-4 text-black md:p-5">
          <div className="grid gap-4">
            <AnimatePresence initial={false}>
              {pendingSteps.map((step) => {
                const Icon = step.icon;

                return (
                  <motion.div
                    key={step.key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`bauhaus-panel-sm ${step.panel} p-4 md:p-5`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black ${step.iconBox}`}
                        >
                          <Icon size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                          <p className="bauhaus-label opacity-65">Step</p>
                          <h3 className="mt-1 text-lg font-black uppercase tracking-[-0.05em]">
                            {step.label}
                          </h3>
                          <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed opacity-80">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={step.action}
                        className={`bauhaus-button ${
                          step.key === "apikey"
                            ? "bauhaus-button-red"
                            : step.key === "resume"
                              ? "bauhaus-button-blue"
                              : "bauhaus-button-yellow"
                        } !px-4 !py-2 !text-[11px]`}
                      >
                        {step.actionLabel}
                        <ArrowRight size={14} strokeWidth={2.6} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {steps
              .filter((step) => step.done)
              .map((step) => (
                <div
                  key={step.key}
                  className="bauhaus-panel-sm flex items-center gap-3 bg-white px-4 py-3 text-black/70"
                >
                  <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#F0C020]">
                    <CheckCircle2 size={18} strokeWidth={2.4} />
                  </div>
                  <div>
                    <p className="bauhaus-label text-black/45">Completed</p>
                    <p className="text-sm font-semibold tracking-[0.04em]">
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export function OnboardingTriggerButton() {
  const onboarding = useOnboarding();

  if (!onboarding.hydrated) return null;

  return (
    <button
      type="button"
      onClick={() => onboarding.resetWizard()}
      className="bauhaus-button bauhaus-button-blue"
    >
      <Sparkles size={16} strokeWidth={2.6} />
      快速开始
    </button>
  );
}
