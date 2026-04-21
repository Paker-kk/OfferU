"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Card,
  CardBody,
} from "@nextui-org/react";
import {
  Sparkles,
  Key,
  FileText,
  Upload,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  PenTool,
  CheckCircle2,
} from "lucide-react";
import { bauhausFieldClassNames } from "@/lib/bauhaus";
import { createResume, updateConfig, useConfig } from "@/lib/hooks";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 4;
const CUSTOM_OPTION = "__custom__";

interface ProviderModelPreset {
  id: string;
  name: string;
  description?: string;
}

interface ProviderPreset {
  id: string;
  name: string;
  description?: string;
  default_base_url: string;
  models: ProviderModelPreset[];
  key_prefix?: string;
}

const FALLBACK_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Mainstream global provider",
    default_base_url: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4.1", name: "GPT-4.1" },
    ],
    key_prefix: "sk-",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Cost-effective Chinese model",
    default_base_url: "https://api.deepseek.com",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
    key_prefix: "sk-",
  },
  {
    id: "qwen",
    name: "通义千问",
    description: "Alibaba DashScope",
    default_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-plus", name: "Qwen Plus" },
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen-max", name: "Qwen Max" },
    ],
    key_prefix: "sk-",
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    description: "Model aggregation provider",
    default_base_url: "https://api.siliconflow.com/v1",
    models: [
      { id: "deepseek-ai/DeepSeek-V3.2", name: "DeepSeek-V3.2" },
      { id: "Qwen/Qwen3-32B", name: "Qwen3-32B" },
    ],
    key_prefix: "sk-",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini OpenAI-compatible endpoint",
    default_base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    ],
    key_prefix: "",
  },
  {
    id: "zhipu",
    name: "智谱",
    description: "BigModel Open Platform",
    default_base_url: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-5.1", name: "GLM-5.1" },
      { id: "glm-4.6", name: "GLM-4.6" },
    ],
    key_prefix: "",
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local inference",
    default_base_url: "http://localhost:11434/v1",
    models: [
      { id: "qwen2.5:7b", name: "Qwen2.5 7B" },
      { id: "llama3.1:8b", name: "Llama 3.1 8B" },
    ],
    key_prefix: "",
  },
];

const DEFAULT_PROVIDER_PRESET =
  FALLBACK_PROVIDER_PRESETS.find((preset) => preset.id === "deepseek") || FALLBACK_PROVIDER_PRESETS[0];

const RESUME_TEMPLATES = [
  { id: "tech", label: "Tech Focus" },
  { id: "business", label: "Business Focus" },
  { id: "general", label: "General Use" },
];

const bauhausAutocompleteClassNames = {
  popoverContent:
    "rounded-none border-2 border-black bg-[#F0F0F0] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]",
  listboxWrapper: "max-h-56 bg-[#F0F0F0] p-1",
};

function normalizeProviderId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "custom";
}

function createConfigId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBaseUrl(value: string, providerId: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (providerId === "ollama" && !trimmed.endsWith("/v1")) {
    return `${trimmed}/v1`;
  }
  return trimmed;
}

function toLegacyOllamaBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const router = useRouter();
  const { data: configData } = useConfig();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>(FALLBACK_PROVIDER_PRESETS);
  const [formProviderChoice, setFormProviderChoice] = useState<string>(DEFAULT_PROVIDER_PRESET.id);
  const [formCustomServiceName, setFormCustomServiceName] = useState("");
  const [formModelChoice, setFormModelChoice] = useState<string>(DEFAULT_PROVIDER_PRESET.models[0]?.id || "");
  const [formCustomModel, setFormCustomModel] = useState("");
  const [formUrlChoice, setFormUrlChoice] = useState<string>(DEFAULT_PROVIDER_PRESET.default_base_url);
  const [formBaseUrl, setFormBaseUrl] = useState(DEFAULT_PROVIDER_PRESET.default_base_url);
  const [formApiKey, setFormApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configSaveError, setConfigSaveError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const providerSelectionRef = useRef(false);
  const modelSelectionRef = useRef(false);
  const urlSelectionRef = useRef(false);

  const [resumeMode, setResumeMode] = useState<"choose" | "create" | "upload">("choose");
  const [userName, setUserName] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("general");
  const [creatingResume, setCreatingResume] = useState(false);
  const [resumeCreated, setResumeCreated] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const goNext = () => {
    setDirection(1);
    setStep((value) => Math.min(value + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((value) => Math.max(value - 1, 0));
  };

  const currentFormPreset = useMemo(
    () => providerPresets.find((preset) => preset.id === formProviderChoice),
    [providerPresets, formProviderChoice]
  );

  const formModelOptions = useMemo(() => currentFormPreset?.models || [], [currentFormPreset]);
  const providerOptions = useMemo(
    () => providerPresets.map((preset) => ({ id: preset.id, name: preset.name, description: preset.description || "" })),
    [providerPresets]
  );
  const modelOptions = useMemo(
    () => formModelOptions.map((model) => ({ id: model.id, name: model.name, description: model.description || "" })),
    [formModelOptions]
  );
  const urlOptions = useMemo(() => {
    if (!currentFormPreset?.default_base_url) {
      return [] as { id: string; name: string }[];
    }
    return [{ id: currentFormPreset.default_base_url, name: `Default URL · ${currentFormPreset.default_base_url}` }];
  }, [currentFormPreset]);

  const resolvedFormServiceName = useMemo(() => {
    if (formProviderChoice === CUSTOM_OPTION) return formCustomServiceName.trim();
    return currentFormPreset?.name || "";
  }, [currentFormPreset, formCustomServiceName, formProviderChoice]);

  const resolvedFormProviderId = useMemo(() => {
    if (formProviderChoice === CUSTOM_OPTION) return normalizeProviderId(formCustomServiceName);
    return formProviderChoice;
  }, [formCustomServiceName, formProviderChoice]);

  const resolvedFormModel = useMemo(() => {
    if (formModelChoice === CUSTOM_OPTION) return formCustomModel.trim();
    return formModelChoice;
  }, [formCustomModel, formModelChoice]);

  const resolvedFormBaseUrl = useMemo(() => {
    if (formUrlChoice === CUSTOM_OPTION) return formBaseUrl.trim();
    return formUrlChoice.trim();
  }, [formBaseUrl, formUrlChoice]);

  useEffect(() => {
    const presetsFromServer = Array.isArray((configData as any)?.provider_presets)
      ? ((configData as any).provider_presets as ProviderPreset[])
      : [];
    if (presetsFromServer.length > 0) {
      setProviderPresets(presetsFromServer);
    }
  }, [configData]);

  const validateAiForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!resolvedFormServiceName) errors.service_name = "服务名不能为空";
    if (!resolvedFormModel) errors.model = "模型名不能为空";
    if (!resolvedFormBaseUrl) {
      errors.base_url = "API URL 不能为空";
    } else if (!/^https?:\/\//i.test(resolvedFormBaseUrl)) {
      errors.base_url = "API URL 需要以 http:// 或 https:// 开头";
    }
    if (resolvedFormProviderId !== "ollama") {
      if (!formApiKey.trim()) errors.api_key = "API Key 不能为空";
      if (formApiKey.includes("*")) errors.api_key = "请填写完整密钥，不能使用脱敏值";
      const prefix = currentFormPreset?.key_prefix || "";
      if (prefix && formApiKey.trim() && !formApiKey.trim().startsWith(prefix)) {
        errors.api_key = `当前服务的密钥通常以 ${prefix} 开头`;
      }
    }
    return errors;
  };

  useEffect(() => {
    if (step !== 1) return;
    setFormErrors(validateAiForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formProviderChoice, formCustomServiceName, formModelChoice, formCustomModel, formUrlChoice, formBaseUrl, formApiKey]);

  const resetAiStepStatus = () => {
    setConfigSaved(false);
    setConfigSaveError("");
  };

  const handleProviderChoiceChange = (value: string) => {
    resetAiStepStatus();
    setFormProviderChoice(value);

    if (value === CUSTOM_OPTION) {
      setFormCustomServiceName(resolvedFormServiceName);
      setFormModelChoice(CUSTOM_OPTION);
      setFormCustomModel(resolvedFormModel);
      setFormUrlChoice(CUSTOM_OPTION);
      setFormBaseUrl(resolvedFormBaseUrl);
      return;
    }

    const preset = providerPresets.find((item) => item.id === value);
    if (!preset) return;

    setFormCustomServiceName("");
    setFormModelChoice(preset.models[0]?.id || CUSTOM_OPTION);
    setFormCustomModel("");
    setFormUrlChoice(preset.default_base_url);
    setFormBaseUrl(preset.default_base_url);

    if (preset.id === "ollama") {
      setFormApiKey("");
    }
  };

  const handleServiceInputChange = (value: string) => {
    resetAiStepStatus();
    if (formProviderChoice !== CUSTOM_OPTION) {
      setFormProviderChoice(CUSTOM_OPTION);
      setFormModelChoice(CUSTOM_OPTION);
      setFormCustomModel(resolvedFormModel);
      setFormUrlChoice(CUSTOM_OPTION);
      setFormBaseUrl(resolvedFormBaseUrl);
    }
    setFormCustomServiceName(value);
  };

  const handleModelInputChange = (value: string) => {
    resetAiStepStatus();
    if (formModelChoice !== CUSTOM_OPTION) {
      setFormCustomModel(resolvedFormModel);
      setFormModelChoice(CUSTOM_OPTION);
    }
    setFormCustomModel(value);
  };

  const handleUrlInputChange = (value: string) => {
    resetAiStepStatus();
    if (formUrlChoice !== CUSTOM_OPTION) {
      setFormBaseUrl(resolvedFormBaseUrl);
      setFormUrlChoice(CUSTOM_OPTION);
    }
    setFormBaseUrl(value);
  };

  const handleSaveAiConfig = async () => {
    const errors = validateAiForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSavingConfig(true);
    setConfigSaveError("");

    const providerId = resolvedFormProviderId;
    const nextConfig = {
      id: createConfigId(),
      provider_id: providerId,
      service_name: resolvedFormServiceName,
      model: resolvedFormModel,
      base_url: normalizeBaseUrl(resolvedFormBaseUrl, providerId),
      api_key: providerId === "ollama" ? "" : formApiKey.trim(),
      is_active: true,
      extra_params: {},
    };

    const incomingConfigs = Array.isArray((configData as any)?.llm_api_configs)
      ? ((configData as any).llm_api_configs as any[])
      : [];

    const normalizedExisting = incomingConfigs
      .map((item) => {
        const itemProviderId = normalizeProviderId(String(item?.provider_id || item?.service_name || "custom"));
        return {
          id: String(item?.id || createConfigId()),
          provider_id: itemProviderId,
          service_name: String(item?.service_name || itemProviderId).trim(),
          model: String(item?.model || "").trim(),
          base_url: normalizeBaseUrl(String(item?.base_url || ""), itemProviderId),
          api_key: String(item?.api_key || ""),
          is_active: Boolean(item?.is_active),
          extra_params: (item?.extra_params || {}) as Record<string, string>,
        };
      })
      .filter((item) => item.service_name && item.model && item.base_url);

    const previousActiveId = String((configData as any)?.active_llm_config_id || "");
    const mergedConfigs = [
      ...normalizedExisting.filter((item) => item.id !== previousActiveId),
      nextConfig,
    ];

    const finalConfigs = mergedConfigs
      .map((item) => {
        const itemProviderId = normalizeProviderId(item.provider_id || item.service_name);
        return {
          ...item,
          provider_id: itemProviderId,
          service_name: item.service_name.trim(),
          model: item.model.trim(),
          base_url: normalizeBaseUrl(item.base_url, itemProviderId),
          api_key: itemProviderId === "ollama" ? "" : item.api_key.trim(),
          is_active: item.id === nextConfig.id,
        };
      })
      .filter((item) => item.service_name && item.model && item.base_url);

    const activeConfig = finalConfigs.find((item) => item.id === nextConfig.id) || null;
    const getProviderConfig = (targetProviderId: string) =>
      finalConfigs.find((item) => item.provider_id === targetProviderId) || null;

    const deepseekConfig = getProviderConfig("deepseek");
    const openaiConfig = getProviderConfig("openai");
    const qwenConfig = getProviderConfig("qwen");
    const siliconflowConfig = getProviderConfig("siliconflow");
    const geminiConfig = getProviderConfig("gemini");
    const zhipuConfig = getProviderConfig("zhipu");
    const ollamaConfig = getProviderConfig("ollama");

    try {
      await updateConfig({
        llm_api_configs: finalConfigs,
        active_llm_config_id: activeConfig?.id || "",
        llm_provider: activeConfig?.provider_id || "",
        llm_model: activeConfig?.model || "",
        active_llm_base_url: activeConfig?.base_url || "",
        active_llm_api_key: activeConfig?.api_key || "",
        deepseek_api_key: deepseekConfig?.api_key || "",
        openai_api_key: openaiConfig?.api_key || "",
        qwen_api_key: qwenConfig?.api_key || "",
        siliconflow_api_key: siliconflowConfig?.api_key || "",
        gemini_api_key: geminiConfig?.api_key || "",
        zhipu_api_key: zhipuConfig?.api_key || "",
        ollama_base_url: toLegacyOllamaBaseUrl(
          ollamaConfig?.base_url || "http://localhost:11434/v1"
        ),
      });
      setConfigSaved(true);
      setTimeout(goNext, 600);
    } catch (error) {
      setConfigSaveError(error instanceof Error ? error.message : "保存失败，请稍后重试");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!userName.trim()) return;
    setCreatingResume(true);

    try {
      const templateTitles: Record<string, string> = {
        tech: "技术岗简历",
        business: "商科岗简历",
        general: "我的简历",
      };

      await createResume({
        user_name: userName.trim(),
        title: templateTitles[selectedTemplate] || "我的简历",
        school: school.trim() || undefined,
        major: major.trim() || undefined,
        template: selectedTemplate,
      });

      setResumeCreated(true);
      setTimeout(goNext, 800);
    } catch {
      goNext();
    } finally {
      setCreatingResume(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadResult(null);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/resume/parse`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("解析失败");
      const data = await res.json();
      setUploadResult(`已解析 ${data.filename}，稍后可以继续在简历编辑器中精修。`);

      await createResume({
        user_name: "待完善",
        title: file.name.replace(/\.(pdf|docx)$/i, ""),
        raw_text: data.text,
      });

      setResumeCreated(true);
      setTimeout(goNext, 1000);
    } catch {
      setUploadResult("文件解析失败，请确认上传的是有效的 PDF 或 Word 文档。");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFinish = (goToPage?: string) => {
    onComplete();
    if (goToPage) {
      router.push(goToPage);
    }
  };

  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  const stepDetails = [
    {
      id: "01",
      label: "Welcome",
      headline: ["Meet", "OfferU"],
      note: "先用几步把 AI、简历与职位流转入口接通。",
      activePanel: "bg-[#F0C020] text-black",
    },
    {
      id: "02",
      label: "AI Config",
      headline: ["Connect", "Model"],
      note: "把模型、密钥和 endpoint 接好，后续所有智能能力都会用到。",
      activePanel: "bg-white text-black",
    },
    {
      id: "03",
      label: "Resume",
      headline: ["Make", "Base"],
      note: "创建第一份基础简历，之后再为不同岗位克隆和定制。",
      activePanel: "bg-[#D02020] text-white",
    },
    {
      id: "04",
      label: "Launch",
      headline: ["Fetch", "Jobs"],
      note: "准备完成后，直接进入职位采集和筛选工作台。",
      activePanel: "bg-[#F0C020] text-black",
    },
  ] as const;

  const currentStep = stepDetails[step] || stepDetails[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto bg-[#F0F0F0] text-black"
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-3rem] top-12 h-28 w-28 rounded-full border-4 border-black bg-[#F0C020]/80" />
        <div className="absolute right-[10%] top-20 h-24 w-24 rotate-45 border-4 border-black bg-[#D02020]/80" />
        <div className="bauhaus-triangle absolute bottom-8 right-8 h-32 w-32 border-4 border-black bg-[#1040C0]/80" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-10">
        <div className="bauhaus-panel relative w-full overflow-hidden bg-white">
          <div className="grid lg:grid-cols-[0.84fr_1.16fr]">
            <aside className="relative overflow-hidden border-b-2 border-black bg-[#1040C0] text-white lg:border-b-0 lg:border-r-2">
              <div aria-hidden className="absolute inset-0 bauhaus-dot-pattern opacity-20" />
              <div className="absolute left-6 top-8 h-14 w-14 rounded-full border-4 border-black bg-[#F0C020]" />
              <div className="absolute right-20 top-20 h-12 w-12 rotate-45 border-4 border-black bg-[#D02020]" />
              <div className="bauhaus-triangle absolute bottom-10 left-8 h-16 w-16 border-4 border-black bg-white" />

              <button
                type="button"
                onClick={onSkip}
                className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px]"
              >
                <X size={18} strokeWidth={2.8} />
              </button>

              <div className="relative z-[1] space-y-6 p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full border-2 border-black bg-[#F0C020]" />
                  <span className="h-5 w-5 border-2 border-black bg-[#D02020]" />
                  <span className="bauhaus-triangle h-5 w-5 border-2 border-black bg-white" />
                </div>

                <div className="space-y-4">
                  <span className="bauhaus-chip bg-white text-black">OfferU Setup</span>
                  <div>
                    <p className="bauhaus-label text-white/70">{currentStep.label}</p>
                    <h1 className="mt-3 text-5xl font-black uppercase leading-[0.86] tracking-[-0.09em] md:text-6xl">
                      {currentStep.headline[0]}
                      <br />
                      {currentStep.headline[1]}
                    </h1>
                    <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-white/82 md:text-base">
                      {currentStep.note}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {stepDetails.map((item, index) => (
                    <div
                      key={item.id}
                      className={`bauhaus-panel-sm px-4 py-4 ${
                        index === step ? item.activePanel : "bg-[#F0F0F0] text-black"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="bauhaus-label opacity-75">Step {item.id}</p>
                          <p className="mt-2 text-lg font-black uppercase tracking-[-0.05em]">
                            {item.label}
                          </p>
                        </div>
                        <span className="text-2xl font-black uppercase tracking-[-0.08em]">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bauhaus-panel-sm bg-white px-4 py-4 text-sm font-medium leading-relaxed text-black">
                  进度 {step + 1} / {TOTAL_STEPS}
                  <div className="mt-3 h-3 border-2 border-black bg-[#F0F0F0]">
                    <div className="h-full bg-[#D02020]" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                {step < TOTAL_STEPS - 1 && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="text-sm font-semibold tracking-[0.06em] text-white/82 underline underline-offset-4"
                  >
                    Skip Setup
                  </button>
                )}
              </div>
            </aside>

            <div className="bg-[#F0F0F0] p-5 md:p-8">
              <div className="mb-6 space-y-3">
                <div className="overflow-hidden border-2 border-black bg-white">
                  <motion.div
                    className="h-4 border-r-2 border-black bg-[#D02020]"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: "spring", damping: 20 }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {stepDetails.map((item, index) => (
                    <span
                      key={item.id}
                      className={`bauhaus-chip ${
                        index === step ? item.activePanel : "bg-white text-black"
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && (
                  <motion.div
                    key="welcome"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <span className="bauhaus-chip bg-[#F0C020] text-black">Start Here</span>
                      <div>
                        <h2 className="text-5xl font-black uppercase leading-[0.86] tracking-[-0.09em] md:text-7xl">
                          Build
                          <br />
                          Your
                          <br />
                          Job OS
                        </h2>
                        <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                          OfferU 会在几步内配置 AI 能力、建立第一份基础简历，并把你送进岗位抓取与筛选工作流。
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="bauhaus-panel-sm bg-[#F0C020] p-4">
                        <p className="bauhaus-label text-black/55">1</p>
                        <p className="mt-3 text-xl font-black uppercase tracking-[-0.05em]">Connect AI</p>
                      </div>
                      <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
                        <p className="bauhaus-label text-white/70">2</p>
                        <p className="mt-3 text-xl font-black uppercase tracking-[-0.05em]">Create Base</p>
                      </div>
                      <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
                        <p className="bauhaus-label text-white/70">3</p>
                        <p className="mt-3 text-xl font-black uppercase tracking-[-0.05em]">Launch Flow</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="bauhaus-button bauhaus-button-red"
                        endContent={<ArrowRight size={16} />}
                        onPress={goNext}
                      >
                        Begin Setup
                      </Button>
                      <Button
                        className="bauhaus-button bauhaus-button-outline"
                        onPress={onSkip}
                      >
                        Skip For Now
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="apikey"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <span className="bauhaus-chip bg-[#F0C020] text-black">AI Power</span>
                      <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] md:text-6xl">
                        Connect
                        <br />
                        Provider
                      </h2>
                      <p className="max-w-2xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                        选择服务商、模型和 API 地址。保存后会同步到设置页，后续页面都将直接复用这套配置。
                      </p>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
                      <Card className="rounded-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]">
                        <CardBody className="space-y-4 p-5 md:p-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Autocomplete
                              label="Service"
                              variant="bordered"
                              allowsCustomValue
                              menuTrigger="manual"
                              selectedKey={formProviderChoice === CUSTOM_OPTION ? null : formProviderChoice}
                              value={formProviderChoice === CUSTOM_OPTION ? formCustomServiceName : resolvedFormServiceName}
                              onInputChange={(value) => {
                                if (providerSelectionRef.current) {
                                  providerSelectionRef.current = false;
                                  return;
                                }
                                handleServiceInputChange(value);
                              }}
                              onSelectionChange={(key) => {
                                if (!key) return;
                                providerSelectionRef.current = true;
                                handleProviderChoiceChange(String(key));
                              }}
                              isInvalid={Boolean(formErrors.service_name)}
                              errorMessage={formErrors.service_name}
                              placeholder="例如 DeepSeek"
                              inputProps={{ classNames: bauhausFieldClassNames }}
                              classNames={bauhausAutocompleteClassNames}
                            >
                              {providerOptions.map((item) => (
                                <AutocompleteItem key={item.id} textValue={item.name}>
                                  <div className="flex flex-col">
                                    <span>{item.name}</span>
                                    {item.description && (
                                      <span className="text-xs text-black/55">{item.description}</span>
                                    )}
                                  </div>
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>

                            <Autocomplete
                              label="Model"
                              variant="bordered"
                              allowsCustomValue
                              menuTrigger="manual"
                              selectedKey={formModelChoice === CUSTOM_OPTION ? null : formModelChoice}
                              value={formModelChoice === CUSTOM_OPTION ? formCustomModel : resolvedFormModel}
                              onInputChange={(value) => {
                                if (modelSelectionRef.current) {
                                  modelSelectionRef.current = false;
                                  return;
                                }
                                handleModelInputChange(value);
                              }}
                              onSelectionChange={(key) => {
                                if (!key) return;
                                modelSelectionRef.current = true;
                                resetAiStepStatus();
                                setFormModelChoice(String(key));
                                setFormCustomModel("");
                              }}
                              isInvalid={Boolean(formErrors.model)}
                              errorMessage={formErrors.model}
                              placeholder="例如 deepseek-chat"
                              inputProps={{ classNames: bauhausFieldClassNames }}
                              classNames={bauhausAutocompleteClassNames}
                            >
                              {modelOptions.map((item) => (
                                <AutocompleteItem key={item.id} textValue={item.name}>
                                  <div className="flex flex-col">
                                    <span>{item.name}</span>
                                    {item.description && (
                                      <span className="text-xs text-black/55">{item.description}</span>
                                    )}
                                  </div>
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>

                            <Autocomplete
                              label="API URL"
                              variant="bordered"
                              allowsCustomValue
                              menuTrigger="manual"
                              selectedKey={formUrlChoice === CUSTOM_OPTION ? null : formUrlChoice}
                              value={formUrlChoice === CUSTOM_OPTION ? formBaseUrl : resolvedFormBaseUrl}
                              onInputChange={(value) => {
                                if (urlSelectionRef.current) {
                                  urlSelectionRef.current = false;
                                  return;
                                }
                                handleUrlInputChange(value);
                              }}
                              onSelectionChange={(key) => {
                                if (!key) return;
                                urlSelectionRef.current = true;
                                resetAiStepStatus();
                                const nextValue = String(key);
                                setFormUrlChoice(nextValue);
                                setFormBaseUrl(nextValue);
                              }}
                              isInvalid={Boolean(formErrors.base_url)}
                              errorMessage={formErrors.base_url}
                              placeholder="https://..."
                              inputProps={{ classNames: bauhausFieldClassNames }}
                              classNames={bauhausAutocompleteClassNames}
                              className="sm:col-span-2"
                            >
                              {urlOptions.map((item) => (
                                <AutocompleteItem key={item.id} textValue={item.name}>
                                  {item.name}
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>

                            <Input
                              label="API Key"
                              placeholder={resolvedFormProviderId === "ollama" ? "Ollama 无需密钥" : "sk-..."}
                              variant="bordered"
                              type={showKey ? "text" : "password"}
                              value={formApiKey}
                              onValueChange={(value) => {
                                resetAiStepStatus();
                                setFormApiKey(value);
                              }}
                              isDisabled={resolvedFormProviderId === "ollama"}
                              isInvalid={Boolean(formErrors.api_key)}
                              errorMessage={formErrors.api_key}
                              classNames={{
                                ...bauhausFieldClassNames,
                                base: "sm:col-span-2",
                              }}
                              startContent={<Key size={16} className="text-black/55" />}
                              endContent={
                                <button
                                  type="button"
                                  onClick={() => setShowKey(!showKey)}
                                  className="text-black/55 hover:text-black"
                                >
                                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              }
                            />
                          </div>

                          <div className="bauhaus-panel-sm bg-[#F0F0F0] px-4 py-4 text-sm font-medium leading-relaxed text-black/72">
                            这一步可以稍后补充；如果先跳过，之后仍可在设置页新增或切换多套 API 配置。
                          </div>

                          {configSaveError && (
                            <div className="bauhaus-panel-sm bg-[#D02020] px-4 py-4 text-sm font-medium leading-relaxed text-white">
                              {configSaveError}
                            </div>
                          )}

                          {configSaved && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bauhaus-panel-sm flex items-center gap-2 bg-[#F0C020] px-4 py-4 text-sm font-medium text-black"
                            >
                              <CheckCircle2 size={18} strokeWidth={2.6} />
                              <span>AI 配置已保存并同步。</span>
                            </motion.div>
                          )}
                        </CardBody>
                      </Card>

                      <div className="space-y-4">
                        <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
                          <p className="bauhaus-label text-black/55">Recommended</p>
                          <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">
                            {DEFAULT_PROVIDER_PRESET.name}
                          </p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-black/72">
                            默认推荐先接入稳定且响应快的模型，等工作流跑顺后再扩展更多 provider。
                          </p>
                        </div>
                        <div className="bauhaus-panel-sm bg-white p-4 text-black">
                          <p className="bauhaus-label text-black/55">Support</p>
                          <p className="mt-3 text-lg font-black uppercase tracking-[-0.05em]">
                            Custom Service
                          </p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-black/72">
                            输入自定义服务名、模型和 URL 即可接入 OpenAI 兼容接口。
                          </p>
                        </div>
                        <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
                          <p className="bauhaus-label text-white/70">Security</p>
                          <p className="mt-3 text-lg font-black uppercase tracking-[-0.05em]">
                            Store Once
                          </p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-white/82">
                            API Key 只在保存时写入配置，平时可以继续切换展示或隐藏输入内容。
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        className="bauhaus-button bauhaus-button-outline"
                        startContent={<ArrowLeft size={16} />}
                        onPress={goBack}
                      >
                        Back
                      </Button>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={goNext}
                          className="text-sm font-semibold tracking-[0.06em] text-black/55 underline underline-offset-4"
                        >
                          Skip
                        </button>
                        <Button
                          className="bauhaus-button bauhaus-button-red"
                          endContent={configSaved ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                          isLoading={savingConfig}
                          onPress={handleSaveAiConfig}
                        >
                          {configSaved ? "Saved" : "Save & Continue"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="resume"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <span className="bauhaus-chip bg-[#F0C020] text-black">Resume Base</span>
                      <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] md:text-6xl">
                        Create
                        <br />
                        First Draft
                      </h2>
                      <p className="max-w-2xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                        先有一份基础简历，后面的岗位定制和批量生成才有稳定底板。
                      </p>
                    </div>

                    {resumeCreated ? (
                      <motion.div
                        initial={{ scale: 0.94, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bauhaus-panel bg-[#F0C020] p-8 text-center text-black"
                      >
                        <CheckCircle2 size={54} strokeWidth={2.4} className="mx-auto" />
                        <p className="mt-4 text-3xl font-black uppercase tracking-[-0.06em]">
                          Resume Ready
                        </p>
                        <p className="mt-3 text-sm font-medium leading-relaxed text-black/72">
                          基础简历已经创建，正在进入下一步。
                        </p>
                      </motion.div>
                    ) : resumeMode === "choose" ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Card
                            isPressable
                            className="rounded-none border-2 border-black bg-[#1040C0] text-white shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]"
                            onPress={() => setResumeMode("create")}
                          >
                            <CardBody className="flex min-h-[220px] flex-col justify-between p-5">
                              <PenTool size={34} strokeWidth={2.4} />
                              <div>
                                <p className="bauhaus-label text-white/70">Option A</p>
                                <p className="mt-3 text-3xl font-black uppercase tracking-[-0.06em]">
                                  Quick Create
                                </p>
                                <p className="mt-3 text-sm font-medium leading-relaxed text-white/82">
                                  回答几个基础问题，快速生成第一份可编辑简历。
                                </p>
                              </div>
                            </CardBody>
                          </Card>

                          <Card
                            isPressable
                            className="rounded-none border-2 border-black bg-[#F0C020] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]"
                            onPress={() => setResumeMode("upload")}
                          >
                            <CardBody className="flex min-h-[220px] flex-col justify-between p-5">
                              <Upload size={34} strokeWidth={2.4} />
                              <div>
                                <p className="bauhaus-label text-black/55">Option B</p>
                                <p className="mt-3 text-3xl font-black uppercase tracking-[-0.06em]">
                                  Upload Parse
                                </p>
                                <p className="mt-3 text-sm font-medium leading-relaxed text-black/72">
                                  导入现有 PDF 或 Word 简历，自动解析为可继续优化的初稿。
                                </p>
                              </div>
                            </CardBody>
                          </Card>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Button
                            className="bauhaus-button bauhaus-button-outline"
                            startContent={<ArrowLeft size={16} />}
                            onPress={goBack}
                          >
                            Back
                          </Button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="text-sm font-semibold tracking-[0.06em] text-black/55 underline underline-offset-4"
                          >
                            Skip
                          </button>
                        </div>
                      </>
                    ) : resumeMode === "create" ? (
                      <div className="space-y-6">
                        <div className="grid gap-6 xl:grid-cols-[1fr_0.88fr]">
                          <Card className="rounded-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]">
                            <CardBody className="space-y-4 p-5 md:p-6">
                              <Input
                                label="Name"
                                placeholder="输入你的姓名"
                                variant="bordered"
                                size="sm"
                                value={userName}
                                onValueChange={setUserName}
                                autoFocus
                                classNames={bauhausFieldClassNames}
                              />
                              <div className="grid gap-4 sm:grid-cols-2">
                                <Input
                                  label="School"
                                  placeholder="例如 浙江大学"
                                  variant="bordered"
                                  size="sm"
                                  value={school}
                                  onValueChange={setSchool}
                                  classNames={bauhausFieldClassNames}
                                />
                                <Input
                                  label="Major"
                                  placeholder="例如 计算机科学"
                                  variant="bordered"
                                  size="sm"
                                  value={major}
                                  onValueChange={setMajor}
                                  classNames={bauhausFieldClassNames}
                                />
                              </div>
                            </CardBody>
                          </Card>

                          <div className="space-y-4">
                            <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
                              <p className="bauhaus-label text-white/70">Template</p>
                              <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">
                                Choose Direction
                              </p>
                            </div>

                            <div className="grid gap-3">
                              {RESUME_TEMPLATES.map((template, index) => (
                                <button
                                  key={template.id}
                                  type="button"
                                  onClick={() => setSelectedTemplate(template.id)}
                                  className={`bauhaus-panel-sm p-4 text-left transition-transform hover:-translate-y-[1px] ${
                                    selectedTemplate === template.id
                                      ? index === 0
                                        ? "bg-[#1040C0] text-white"
                                        : index === 1
                                          ? "bg-[#F0C020] text-black"
                                          : "bg-[#D02020] text-white"
                                      : "bg-white text-black"
                                  }`}
                                >
                                  <p className="bauhaus-label opacity-70">Template {index + 1}</p>
                                  <p className="mt-2 text-xl font-black uppercase tracking-[-0.05em]">
                                    {template.label}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="bauhaus-button bauhaus-button-outline"
                            onPress={() => setResumeMode("choose")}
                          >
                            Back To Options
                          </Button>
                          <Button
                            className="bauhaus-button bauhaus-button-red"
                            isLoading={creatingResume}
                            isDisabled={!userName.trim()}
                            onPress={handleQuickCreate}
                          >
                            Create Resume
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <Card className="rounded-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]">
                          <CardBody className="space-y-4 p-6 text-center">
                            <Upload size={44} strokeWidth={2.4} className="mx-auto" />
                            <div>
                              <p className="text-3xl font-black uppercase tracking-[-0.06em]">
                                Upload Resume
                              </p>
                              <p className="mt-3 text-sm font-medium leading-relaxed text-black/72">
                                支持 PDF 和 Word。系统会自动解析文本并创建一份可继续编辑的草稿。
                              </p>
                            </div>

                            {uploadResult && (
                              <div
                                className={`bauhaus-panel-sm px-4 py-4 text-sm font-medium leading-relaxed ${
                                  resumeCreated
                                    ? "bg-[#F0C020] text-black"
                                    : "bg-[#D02020] text-white"
                                }`}
                              >
                                {uploadResult}
                              </div>
                            )}

                            <label className="inline-flex cursor-pointer">
                              <input
                                type="file"
                                accept=".pdf,.docx"
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={uploadingFile}
                              />
                              <Button
                                as="span"
                                className="bauhaus-button bauhaus-button-blue pointer-events-none"
                                isLoading={uploadingFile}
                              >
                                {uploadingFile ? "Parsing..." : "Select File"}
                              </Button>
                            </label>
                          </CardBody>
                        </Card>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Button
                            className="bauhaus-button bauhaus-button-outline"
                            onPress={() => setResumeMode("choose")}
                          >
                            Back To Options
                          </Button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="text-sm font-semibold tracking-[0.06em] text-black/55 underline underline-offset-4"
                          >
                            Skip For Now
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="scrape"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <span className="bauhaus-chip bg-[#F0C020] text-black">Launch</span>
                      <h2 className="text-5xl font-black uppercase leading-[0.86] tracking-[-0.09em] md:text-7xl">
                        Fetch
                        <br />
                        Match
                        <br />
                        Move
                      </h2>
                      <p className="max-w-2xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                        现在去采集你感兴趣的岗位，OfferU 会用 AI 帮你做匹配、定制简历并继续推进投递节奏。
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
                        <p className="bauhaus-label text-white/70">Collect</p>
                        <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">Scraper</p>
                      </div>
                      <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
                        <p className="bauhaus-label text-black/55">Review</p>
                        <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">Job Pool</p>
                      </div>
                      <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
                        <p className="bauhaus-label text-white/70">Optimize</p>
                        <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">Resume Loop</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="bauhaus-button bauhaus-button-red"
                        endContent={<Briefcase size={16} />}
                        onPress={() => handleFinish("/scraper")}
                      >
                        Collect Jobs
                      </Button>
                      <Button
                        className="bauhaus-button bauhaus-button-blue"
                        endContent={<Sparkles size={16} />}
                        onPress={() => handleFinish("/jobs")}
                      >
                        Open Jobs
                      </Button>
                      <Button
                        className="bauhaus-button bauhaus-button-outline"
                        onPress={() => handleFinish()}
                      >
                        Go Dashboard
                      </Button>
                    </div>

                    <Button
                      className="bauhaus-button bauhaus-button-outline"
                      startContent={<ArrowLeft size={16} />}
                      onPress={goBack}
                    >
                      Back
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
