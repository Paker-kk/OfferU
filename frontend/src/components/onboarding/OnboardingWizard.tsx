// =============================================
// OnboardingWizard — 全屏引导向导
// =============================================
// 首次访问自动弹出，3 步引导：
//   Step 0: 欢迎页（品牌 + Slogan）
//   Step 1: 配置 AI — 内嵌 API Key 输入框（可 Skip）
//   Step 2: 创建简历 — 两个入口（上传识别 / 快速创建）
//   Step 3: 前往采集岗位
// 进度条从 1/4 开始（Zeigarnik effect）
// 允许任意步骤 Skip
// =============================================

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
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { createResume, updateConfig, useConfig } from "@/lib/hooks";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 4; // 0=welcome, 1=apikey, 2=resume, 3=scrape

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

// 预设模板
const RESUME_TEMPLATES = [
  { id: "tech", label: "技术/工程", emoji: "💻", color: "from-blue-500/20 to-cyan-500/20" },
  { id: "business", label: "商科/管理", emoji: "📊", color: "from-amber-500/20 to-orange-500/20" },
  { id: "general", label: "通用模板", emoji: "📄", color: "from-purple-500/20 to-pink-500/20" },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const router = useRouter();
  const { data: configData } = useConfig();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back

  // Step 1: AI config
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

  // Step 2: Resume quick-create
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
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const currentFormPreset = useMemo(
    () => providerPresets.find((preset) => preset.id === formProviderChoice),
    [providerPresets, formProviderChoice]
  );

  const formModelOptions = useMemo(
    () => currentFormPreset?.models || [],
    [currentFormPreset]
  );

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
    return [{ id: currentFormPreset.default_base_url, name: `默认 URL（${currentFormPreset.default_base_url}）` }];
  }, [currentFormPreset]);

  const resolvedFormServiceName = useMemo(() => {
    if (formProviderChoice === CUSTOM_OPTION) {
      return formCustomServiceName.trim();
    }
    return currentFormPreset?.name || "";
  }, [currentFormPreset, formCustomServiceName, formProviderChoice]);

  const resolvedFormProviderId = useMemo(() => {
    if (formProviderChoice === CUSTOM_OPTION) {
      return normalizeProviderId(formCustomServiceName);
    }
    return formProviderChoice;
  }, [formCustomServiceName, formProviderChoice]);

  const resolvedFormModel = useMemo(() => {
    if (formModelChoice === CUSTOM_OPTION) {
      return formCustomModel.trim();
    }
    return formModelChoice;
  }, [formCustomModel, formModelChoice]);

  const resolvedFormBaseUrl = useMemo(() => {
    if (formUrlChoice === CUSTOM_OPTION) {
      return formBaseUrl.trim();
    }
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

    if (!resolvedFormServiceName) {
      errors.service_name = "服务名称不能为空";
    }

    if (!resolvedFormModel) {
      errors.model = "模型名称不能为空";
    }

    if (!resolvedFormBaseUrl) {
      errors.base_url = "API URL 不能为空";
    } else if (!/^https?:\/\//i.test(resolvedFormBaseUrl)) {
      errors.base_url = "API URL 需以 http:// 或 https:// 开头";
    }

    if (resolvedFormProviderId !== "ollama") {
      if (!formApiKey.trim()) {
        errors.api_key = "API 密钥不能为空";
      }
      if (formApiKey.includes("*")) {
        errors.api_key = "请填写完整密钥，不能使用脱敏值";
      }
      const prefix = currentFormPreset?.key_prefix || "";
      if (prefix && formApiKey.trim() && !formApiKey.trim().startsWith(prefix)) {
        errors.api_key = `该服务密钥通常以 ${prefix} 开头`;
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

  // 快速创建简历
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
      // 短暂展示成功后跳到下一步
      setTimeout(goNext, 800);
    } catch {
      goNext();
    } finally {
      setCreatingResume(false);
    }
  };

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      setUploadResult(
        `已解析 ${data.filename}（${data.length} 字），可稍后在简历编辑器中导入内容。`
      );
      // 用解析到的文本自动创建一份简历
      await createResume({
        user_name: "待修改",
        title: file.name.replace(/\.(pdf|docx)$/i, ""),
        raw_text: data.text,
      });
      setResumeCreated(true);
      setTimeout(goNext, 1000);
    } catch {
      setUploadResult("文件解析失败，请确保是有效的 PDF 或 Word 文件。");
    } finally {
      setUploadingFile(false);
    }
  };

  // 完成引导
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
    >
      {/* 关闭 / 跳过 */}
      <button
        onClick={onSkip}
        className="absolute top-6 right-6 text-white/30 hover:text-white/60 transition-colors"
      >
        <X size={24} />
      </button>

      {/* 进度条 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          animate={{ width: `${progressPercent}%` }}
          transition={{ type: "spring", damping: 20 }}
        />
      </div>

      {/* 步骤指示器 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === step
                ? "w-6 bg-blue-500"
                : i < step
                ? "bg-blue-500/40"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* 内容区域 */}
      <div className="w-full max-w-lg px-6">
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
              className="text-center space-y-8"
            >
              {/* Logo / Brand */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 mx-auto"
              >
                <Rocket size={48} className="text-blue-400" />
              </motion.div>

              <div className="space-y-3">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  欢迎来到 OfferU
                </h1>
                <p className="text-xl text-white/60 font-medium">
                  AI主力，中Offer！
                </p>
                <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
                  OfferU 是你的校招 AI 求职助手。从简历优化到岗位采集，
                  从 AI 分析到一键投递，全流程智能加速你的求职之旅。
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  color="primary"
                  endContent={<ArrowRight size={18} />}
                  onPress={goNext}
                  className="font-semibold"
                >
                  开始设置 · 只要 2 分钟
                </Button>
                <button
                  onClick={onSkip}
                  className="text-sm text-white/30 hover:text-white/50 transition-colors"
                >
                  跳过引导，直接使用
                </button>
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
              className="space-y-5"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto mb-2">
                  <Key size={32} className="text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold">配置 AI 能力</h2>
                <p className="text-sm text-white/40">
                  选择服务、模型与 API 地址，保存后将自动同步到设置页的 API 管理列表
                </p>
              </div>

              <Card className="bg-white/5 border border-white/10">
                <CardBody className="space-y-4 p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Autocomplete
                      label="服务选择"
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
                      placeholder="例如：DeepSeek"
                      inputProps={{
                        classNames: {
                          inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                        },
                      }}
                      classNames={{
                        listboxWrapper: "max-h-56",
                      }}
                    >
                      {providerOptions.map((item) => (
                        <AutocompleteItem key={item.id} textValue={item.name}>
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            {item.description && <span className="text-xs text-white/40">{item.description}</span>}
                          </div>
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>

                    <Autocomplete
                      label="模型选择"
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
                      placeholder="例如：deepseek-chat"
                      inputProps={{
                        classNames: {
                          inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                        },
                      }}
                      classNames={{
                        listboxWrapper: "max-h-56",
                      }}
                    >
                      {modelOptions.map((item) => (
                        <AutocompleteItem key={item.id} textValue={item.name}>
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            {item.description && <span className="text-xs text-white/40">{item.description}</span>}
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
                        const value = String(key);
                        setFormUrlChoice(value);
                        setFormBaseUrl(value);
                      }}
                      isInvalid={Boolean(formErrors.base_url)}
                      errorMessage={formErrors.base_url}
                      placeholder="https://..."
                      inputProps={{
                        classNames: {
                          inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                        },
                      }}
                      classNames={{
                        listboxWrapper: "max-h-56",
                        base: "sm:col-span-2",
                      }}
                    >
                      {urlOptions.map((item) => (
                        <AutocompleteItem key={item.id} textValue={item.name}>
                          {item.name}
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>

                    <Input
                      label="API 密钥"
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
                        base: "sm:col-span-2",
                        inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                      }}
                      startContent={<Key size={16} className="text-white/30" />}
                      endContent={
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="text-white/30 hover:text-white/60"
                        >
                          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                  </div>

                  <p className="text-xs text-white/35">
                    当前步骤支持跳过；你也可以稍后在设置页继续新增或调整多套 API 配置。
                  </p>

                  {configSaveError && (
                    <div className="text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">
                      {configSaveError}
                    </div>
                  )}
                </CardBody>
              </Card>

              {configSaved && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-green-400 text-sm"
                >
                  <CheckCircle2 size={16} />
                  <span>AI 配置已保存并同步！</span>
                </motion.div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="flat"
                  startContent={<ArrowLeft size={16} />}
                  onPress={goBack}
                >
                  上一步
                </Button>
                <div className="flex gap-2">
                  <button
                    onClick={goNext}
                    className="text-sm text-white/30 hover:text-white/50 px-4 py-2"
                  >
                    跳过
                  </button>
                  <Button
                    color="primary"
                    endContent={configSaved ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                    isLoading={savingConfig}
                    onPress={handleSaveAiConfig}
                  >
                    {configSaved ? "已保存" : "保存并继续"}
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
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto mb-2">
                  <FileText size={32} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold">创建你的第一份简历</h2>
                <p className="text-sm text-white/40">
                  选择一种方式开始。后续可随时在简历编辑器中精修。
                </p>
              </div>

              {resumeCreated ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-8 space-y-3"
                >
                  <CheckCircle2 size={48} className="text-green-400 mx-auto" />
                  <p className="text-lg font-medium text-green-400">简历创建成功！</p>
                  <p className="text-sm text-white/40">正在进入下一步...</p>
                </motion.div>
              ) : resumeMode === "choose" ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* 快速创建 */}
                  <Card
                    isPressable
                    className="bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all h-[160px]"
                    onPress={() => setResumeMode("create")}
                  >
                    <CardBody className="p-5 text-center space-y-3 flex flex-col items-center justify-center">
                      <PenTool size={32} className="text-blue-400 mx-auto" />
                      <div>
                        <p className="font-semibold text-sm">快速创建</p>
                        <p className="text-xs text-white/40 mt-1">
                          填几个问题，AI 帮你生成
                        </p>
                      </div>
                    </CardBody>
                  </Card>

                  {/* 上传识别 */}
                  <Card
                    isPressable
                    className="bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all h-[160px]"
                    onPress={() => setResumeMode("upload")}
                  >
                    <CardBody className="p-5 text-center space-y-3 flex flex-col items-center justify-center">
                      <Upload size={32} className="text-purple-400 mx-auto" />
                      <div>
                        <p className="font-semibold text-sm">上传识别</p>
                        <p className="text-xs text-white/40 mt-1">
                          导入 PDF / Word 简历
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              ) : resumeMode === "create" ? (
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <Card className="bg-white/5 border border-white/10">
                    <CardBody className="space-y-3 p-4">
                      <Input
                        label="姓名"
                        placeholder="你的真实姓名"
                        variant="bordered"
                        size="sm"
                        value={userName}
                        onValueChange={setUserName}
                        autoFocus
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="学校"
                          placeholder="如：浙江大学"
                          variant="bordered"
                          size="sm"
                          value={school}
                          onValueChange={setSchool}
                        />
                        <Input
                          label="专业"
                          placeholder="如：计算机科学"
                          variant="bordered"
                          size="sm"
                          value={major}
                          onValueChange={setMajor}
                        />
                      </div>
                    </CardBody>
                  </Card>

                  {/* 模板选择 */}
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 font-medium">选择模板方向</p>
                    <div className="grid grid-cols-3 gap-2">
                      {RESUME_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`p-3 rounded-xl border text-center transition-all h-[72px] flex flex-col items-center justify-center ${
                            selectedTemplate === t.id
                              ? "border-blue-500/50 bg-blue-500/10"
                              : "border-white/10 bg-white/3 hover:border-white/20"
                          }`}
                        >
                          <span className="text-2xl block mb-1">{t.emoji}</span>
                          <span className="text-xs font-medium">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="flat"
                      size="sm"
                      onPress={() => setResumeMode("choose")}
                    >
                      返回
                    </Button>
                    <Button
                      color="primary"
                      className="flex-1"
                      isLoading={creatingResume}
                      isDisabled={!userName.trim()}
                      onPress={handleQuickCreate}
                    >
                      创建简历
                    </Button>
                  </div>
                </div>
              ) : (
                /* upload mode */
                <div className="space-y-4">
                  <Card className="bg-white/5 border border-dashed border-white/20 hover:border-blue-500/30 transition-all">
                    <CardBody className="p-8 text-center space-y-3">
                      <Upload size={40} className="text-white/20 mx-auto" />
                      <p className="text-sm text-white/50">
                        上传 PDF / Word 简历文件，AI 自动解析内容
                      </p>
                      {uploadResult && (
                        <p className={`text-xs ${resumeCreated ? "text-green-400" : "text-red-400"}`}>
                          {uploadResult}
                        </p>
                      )}
                      <label className="inline-block cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={uploadingFile}
                        />
                        <Button
                          as="span"
                          variant="flat"
                          size="sm"
                          className="mt-2 pointer-events-none"
                          isLoading={uploadingFile}
                        >
                          {uploadingFile ? "解析中..." : "选择文件"}
                        </Button>
                      </label>
                    </CardBody>
                  </Card>
                  <div className="flex gap-2">
                    <Button
                      variant="flat"
                      size="sm"
                      onPress={() => setResumeMode("choose")}
                    >
                      返回
                    </Button>
                    <button
                      onClick={goNext}
                      className="flex-1 text-sm text-white/30 hover:text-white/50 py-2"
                    >
                      跳过，稍后再创建
                    </button>
                  </div>
                </div>
              )}

              {resumeMode === "choose" && !resumeCreated && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="flat"
                    startContent={<ArrowLeft size={16} />}
                    onPress={goBack}
                  >
                    上一步
                  </Button>
                  <button
                    onClick={goNext}
                    className="text-sm text-white/30 hover:text-white/50 px-4 py-2"
                  >
                    跳过
                  </button>
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
              className="text-center space-y-8"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/20 mx-auto"
              >
                <Briefcase size={40} className="text-green-400" />
              </motion.div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold">一切就绪！</h2>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  现在去采集你感兴趣的岗位，OfferU 将用 AI 帮你分析匹配度、
                  优化简历、追踪投递进度。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <Button
                  size="lg"
                  color="primary"
                  endContent={<Briefcase size={18} />}
                  onPress={() => handleFinish("/scraper")}
                  className="font-semibold"
                >
                  采集岗位
                </Button>
                <Button
                  size="lg"
                  variant="flat"
                  endContent={<Sparkles size={18} />}
                  onPress={() => handleFinish("/jobs")}
                >
                  浏览岗位
                </Button>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="light"
                  startContent={<ArrowLeft size={16} />}
                  onPress={goBack}
                  className="text-white/40"
                >
                  上一步
                </Button>
                <button
                  onClick={() => handleFinish()}
                  className="text-sm text-white/30 hover:text-white/50"
                >
                  直接进入 Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
