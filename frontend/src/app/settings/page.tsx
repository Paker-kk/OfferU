"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import {
  AlertCircle,
  Check,
  Cookie,
  Eye,
  EyeOff,
  Key,
  Plus,
  Save,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useConfig, updateConfig } from "@/lib/hooks";

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

interface LlmApiConfig {
  id: string;
  provider_id: string;
  service_name: string;
  model: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
  extra_params?: Record<string, string>;
}

interface SelectOption {
  id: string;
  label: string;
  description?: string;
}

interface SettingsConfigPayload {
  search_keywords?: string[];
  search_locations?: string[];
  banned_keywords?: string[];
  top_n?: number;
  email_to?: string;
  sources_enabled?: string[];
  profile_source_sync_enabled?: boolean;

  llm_provider?: string;
  llm_model?: string;
  deepseek_api_key?: string;
  openai_api_key?: string;
  qwen_api_key?: string;
  siliconflow_api_key?: string;
  gemini_api_key?: string;
  zhipu_api_key?: string;
  ollama_base_url?: string;

  llm_api_configs?: LlmApiConfig[];
  active_llm_config_id?: string;
  provider_presets?: ProviderPreset[];

  boss_cookie?: string;
  zhilian_cookie?: string;
}

const CUSTOM_OPTION = "__custom__";

const dataSources = [
  { name: "shixiseng", label: "实习僧", available: true },
  { name: "boss", label: "BOSS直聘", available: true },
  { name: "zhilian", label: "智联招聘", available: true },
  { name: "linkedin", label: "LinkedIn", available: true },
  { name: "jobspy", label: "JobSpy 聚合", available: true },
  { name: "bytedance", label: "字节跳动", available: false },
  { name: "alibaba", label: "阿里巴巴", available: false },
  { name: "tencent", label: "腾讯", available: false },
  { name: "maimai", label: "脉脉", available: false },
];

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

function displayMaskedKey(value: string): string {
  if (!value) return "";
  if (value.includes("*")) return value;
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`;
}

function toLegacyOllamaBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

function normalizeApiConfigsForSave(apiConfigs: LlmApiConfig[]) {
  let normalizedConfigs = apiConfigs.map((item) => {
    const providerId = normalizeProviderId(item.provider_id || item.service_name);
    return {
      ...item,
      provider_id: providerId,
      service_name: item.service_name.trim(),
      model: item.model.trim(),
      base_url: normalizeBaseUrl(item.base_url, providerId),
      api_key: providerId === "ollama" ? "" : item.api_key.trim(),
      extra_params: item.extra_params || {},
    };
  });

  const activeConfig = normalizedConfigs.find((item) => item.is_active) || normalizedConfigs[0] || null;
  if (activeConfig) {
    normalizedConfigs = normalizedConfigs.map((item) => ({
      ...item,
      is_active: item.id === activeConfig.id,
    }));
  }

  return {
    normalizedConfigs,
    activeConfig,
  };
}

export default function SettingsPage() {
  const { data, mutate } = useConfig();
  const config = data as SettingsConfigPayload | undefined;

  const [apiSaving, setApiSaving] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);
  const [apiSaveError, setApiSaveError] = useState("");
  const [apiDirty, setApiDirty] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchLocations, setSearchLocations] = useState("");
  const [bannedKeywords, setBannedKeywords] = useState("");
  const [topN, setTopN] = useState("15");
  const [emailTo, setEmailTo] = useState("");
  const [sourcesEnabled, setSourcesEnabled] = useState<string[]>(["linkedin"]);
  const [profileSourceSyncEnabled, setProfileSourceSyncEnabled] = useState(false);

  const [bossCookie, setBossCookie] = useState("");
  const [zhilianCookie, setZhilianCookie] = useState("");
  const [showBossCookie, setShowBossCookie] = useState(false);
  const [showZhilianCookie, setShowZhilianCookie] = useState(false);

  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>(FALLBACK_PROVIDER_PRESETS);
  const [apiConfigs, setApiConfigs] = useState<LlmApiConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [listFeedback, setListFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const {
    isOpen: isEditorOpen,
    onOpen: onEditorOpen,
    onClose: onEditorClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [formProviderChoice, setFormProviderChoice] = useState<string>("deepseek");
  const [formCustomServiceName, setFormCustomServiceName] = useState("");
  const [formModelChoice, setFormModelChoice] = useState<string>("");
  const [formCustomModel, setFormCustomModel] = useState("");
  const [formUrlChoice, setFormUrlChoice] = useState<string>("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formIsActive, setFormIsActive] = useState<boolean>(false);
  const [showFormApiKey, setShowFormApiKey] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const providerSelectionRef = useRef(false);
  const modelSelectionRef = useRef(false);
  const urlSelectionRef = useRef(false);

  const selectedConfig = useMemo(
    () => apiConfigs.find((item) => item.id === selectedConfigId) || null,
    [apiConfigs, selectedConfigId]
  );

  const currentFormPreset = useMemo(
    () => providerPresets.find((preset) => preset.id === formProviderChoice),
    [providerPresets, formProviderChoice]
  );

  const formModelOptions = useMemo(
    () => currentFormPreset?.models || [],
    [currentFormPreset]
  );

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

  const providerSelectOptions = useMemo<SelectOption[]>(() => {
    return providerPresets.map((preset) => ({
      id: preset.id,
      label: preset.name,
      description: preset.description || "",
    }));
  }, [providerPresets]);

  const modelSelectOptions = useMemo<SelectOption[]>(() => {
    return formModelOptions.map((model) => ({
      id: model.id,
      label: model.name,
      description: model.description || "",
    }));
  }, [formModelOptions]);

  const urlSelectOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [];
    if (currentFormPreset?.default_base_url) {
      list.push({
        id: currentFormPreset.default_base_url,
        label: `默认 URL（${currentFormPreset.default_base_url}）`,
      });
    }
    return list;
  }, [currentFormPreset]);

  const validateEditorForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const providerId = resolvedFormProviderId;

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

    if (providerId !== "ollama") {
      if (!formApiKey.trim()) {
        errors.api_key = "API 密钥不能为空";
      }

      if (!editingConfigId && formApiKey.includes("*")) {
        errors.api_key = "新增配置时不能使用脱敏密钥";
      }

      const prefix = currentFormPreset?.key_prefix || "";
      if (prefix && formApiKey.trim() && !formApiKey.includes("*") && !formApiKey.trim().startsWith(prefix)) {
        errors.api_key = `该服务密钥通常以 ${prefix} 开头`;
      }
    }

    return errors;
  };

  useEffect(() => {
    if (!isEditorOpen) return;
    setFormErrors(validateEditorForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditorOpen,
    formProviderChoice,
    formCustomServiceName,
    formModelChoice,
    formCustomModel,
    formUrlChoice,
    formBaseUrl,
    formApiKey,
    formIsActive,
  ]);

  useEffect(() => {
    if (!config) return;

    setSearchKeywords((config.search_keywords || []).join("\n"));
    setSearchLocations((config.search_locations || []).join("\n"));
    setBannedKeywords((config.banned_keywords || []).join("\n"));
    setTopN(String(config.top_n || 15));
    setEmailTo(config.email_to || "");
    setSourcesEnabled(config.sources_enabled || ["linkedin"]);
    setProfileSourceSyncEnabled(Boolean(config.profile_source_sync_enabled));
    setBossCookie(config.boss_cookie || "");
    setZhilianCookie(config.zhilian_cookie || "");

    const presets = Array.isArray(config.provider_presets) && config.provider_presets.length > 0
      ? config.provider_presets
      : FALLBACK_PROVIDER_PRESETS;
    setProviderPresets(presets);

    const incoming = Array.isArray(config.llm_api_configs) ? config.llm_api_configs : [];
    const normalized = incoming
      .map((item) => ({
        id: item.id || createConfigId(),
        provider_id: normalizeProviderId(item.provider_id || item.service_name || "custom"),
        service_name: (item.service_name || item.provider_id || "Custom").trim(),
        model: (item.model || "").trim(),
        base_url: normalizeBaseUrl(item.base_url || "", normalizeProviderId(item.provider_id || "")),
        api_key: item.api_key || "",
        is_active: Boolean(item.is_active),
        extra_params: item.extra_params || {},
      }))
      .filter((item) => item.service_name && item.model && item.base_url);

    setApiConfigs(normalized);

    const activeIdFromServer = config.active_llm_config_id || "";
    const fallbackSelected = normalized.find((item) => item.is_active)?.id || normalized[0]?.id || "";
    setSelectedConfigId(activeIdFromServer || fallbackSelected);

    setApiDirty(false);
    setApiSaved(false);
    setApiSaveError("");
    setSettingsDirty(false);
    setSettingsSaved(false);
    setSettingsSaveError("");
  }, [config]);

  const markApiDirty = () => {
    setApiDirty(true);
    setApiSaved(false);
    setApiSaveError("");
  };

  const markSettingsDirty = () => {
    setSettingsDirty(true);
    setSettingsSaved(false);
    setSettingsSaveError("");
  };

  const handleSearchKeywordsChange = (value: string) => {
    setSearchKeywords(value);
    markSettingsDirty();
  };

  const handleSearchLocationsChange = (value: string) => {
    setSearchLocations(value);
    markSettingsDirty();
  };

  const handleBannedKeywordsChange = (value: string) => {
    setBannedKeywords(value);
    markSettingsDirty();
  };

  const handleTopNChange = (value: string) => {
    setTopN(value);
    markSettingsDirty();
  };

  const handleEmailToChange = (value: string) => {
    setEmailTo(value);
    markSettingsDirty();
  };

  const handleBossCookieChange = (value: string) => {
    setBossCookie(value);
    markSettingsDirty();
  };

  const handleZhilianCookieChange = (value: string) => {
    setZhilianCookie(value);
    markSettingsDirty();
  };

  const toggleSource = (name: string) => {
    setSourcesEnabled((prev) => {
      const next = prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name];
      return next;
    });
    markSettingsDirty();
  };

  const handleProfileSourceSyncChange = (enabled: boolean) => {
    setProfileSourceSyncEnabled(enabled);
    markSettingsDirty();
  };

  const openCreateEditor = () => {
    const defaultPreset = providerPresets.find((preset) => preset.id === "deepseek") || providerPresets[0];
    if (!defaultPreset) return;

    setEditingConfigId(null);
    setFormProviderChoice(defaultPreset.id);
    setFormCustomServiceName("");
    setFormModelChoice(defaultPreset.models[0]?.id || CUSTOM_OPTION);
    setFormCustomModel("");
    setFormUrlChoice(defaultPreset.default_base_url);
    setFormBaseUrl(defaultPreset.default_base_url);
    setFormApiKey("");
    setFormIsActive(apiConfigs.length === 0);
    setShowFormApiKey(false);
    setFormErrors({});
    setListFeedback(null);
    onEditorOpen();
  };

  const openEditEditor = (configItem: LlmApiConfig) => {
    const matchedPreset = providerPresets.find((preset) => preset.id === configItem.provider_id);

    setEditingConfigId(configItem.id);
    setFormProviderChoice(matchedPreset ? matchedPreset.id : CUSTOM_OPTION);
    setFormCustomServiceName(matchedPreset ? "" : configItem.service_name);

    if (matchedPreset?.models.some((model) => model.id === configItem.model)) {
      setFormModelChoice(configItem.model);
      setFormCustomModel("");
    } else {
      setFormModelChoice(CUSTOM_OPTION);
      setFormCustomModel(configItem.model);
    }

    if (matchedPreset && normalizeBaseUrl(matchedPreset.default_base_url, matchedPreset.id) === normalizeBaseUrl(configItem.base_url, configItem.provider_id)) {
      setFormUrlChoice(matchedPreset.default_base_url);
    } else {
      setFormUrlChoice(CUSTOM_OPTION);
    }
    setFormBaseUrl(configItem.base_url);
    setFormApiKey(configItem.api_key);
    setFormIsActive(configItem.is_active);
    setShowFormApiKey(false);
    setFormErrors({});
    setListFeedback(null);
    onEditorOpen();
  };

  const handleProviderChoiceChange = (value: string) => {
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

  const enableCustomServiceEdit = () => {
    if (formProviderChoice !== CUSTOM_OPTION) {
      setFormCustomServiceName(resolvedFormServiceName);
      setFormProviderChoice(CUSTOM_OPTION);
      setFormModelChoice(CUSTOM_OPTION);
      setFormCustomModel(resolvedFormModel);
      setFormUrlChoice(CUSTOM_OPTION);
      setFormBaseUrl(resolvedFormBaseUrl);
    }
  };

  const handleServiceInputChange = (value: string) => {
    if (formProviderChoice !== CUSTOM_OPTION) {
      enableCustomServiceEdit();
    }
    setFormCustomServiceName(value);
  };

  const enableCustomModelEdit = () => {
    if (formModelChoice !== CUSTOM_OPTION) {
      setFormCustomModel(resolvedFormModel);
      setFormModelChoice(CUSTOM_OPTION);
    }
  };

  const handleModelInputChange = (value: string) => {
    if (formModelChoice !== CUSTOM_OPTION) {
      enableCustomModelEdit();
    }
    setFormCustomModel(value);
  };

  const enableCustomUrlEdit = () => {
    if (formUrlChoice !== CUSTOM_OPTION) {
      setFormBaseUrl(resolvedFormBaseUrl);
      setFormUrlChoice(CUSTOM_OPTION);
    }
  };

  const handleUrlInputChange = (value: string) => {
    if (formUrlChoice !== CUSTOM_OPTION) {
      enableCustomUrlEdit();
    }
    setFormBaseUrl(value);
  };

  const handleActivateConfig = (targetId: string) => {
    setApiConfigs((prev) => prev.map((item) => ({ ...item, is_active: item.id === targetId })));
    setSelectedConfigId(targetId);
    markApiDirty();
    setListFeedback({ type: "success", message: "已切换激活配置，请点击“保存 API 配置”提交" });
  };

  const handleRowClick = (targetId: string) => {
    if (selectedConfigId === targetId) {
      const target = apiConfigs.find((item) => item.id === targetId);
      if (target) openEditEditor(target);
      return;
    }
    setSelectedConfigId(targetId);
  };

  const handleSubmitEditor = () => {
    const errors = validateEditorForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setListFeedback({ type: "error", message: "请先修正表单错误后再保存" });
      return;
    }

    const nextProviderId = resolvedFormProviderId;
    const nextConfig: LlmApiConfig = {
      id: editingConfigId || createConfigId(),
      provider_id: nextProviderId,
      service_name: resolvedFormServiceName,
      model: resolvedFormModel,
      base_url: normalizeBaseUrl(resolvedFormBaseUrl, nextProviderId),
      api_key: nextProviderId === "ollama" ? "" : formApiKey.trim(),
      is_active: formIsActive,
      extra_params: {},
    };

    setApiConfigs((prev) => {
      let next = editingConfigId
        ? prev.map((item) => (item.id === editingConfigId ? nextConfig : item))
        : [...prev, nextConfig];

      const shouldForceOneActive = !next.some((item) => item.is_active);
      if (nextConfig.is_active || shouldForceOneActive) {
        next = next.map((item) => ({ ...item, is_active: item.id === nextConfig.id }));
      }
      return next;
    });

    setSelectedConfigId(nextConfig.id);
    onEditorClose();
    markApiDirty();
    setListFeedback({
      type: "success",
      message: `${editingConfigId ? "配置已更新" : "配置已新增"}，请点击“保存 API 配置”提交`,
    });
  };

  const handleDeleteConfig = () => {
    if (!selectedConfig) return;

    setApiConfigs((prev) => {
      const filtered = prev.filter((item) => item.id !== selectedConfig.id);
      if (filtered.length === 0) {
        setSelectedConfigId("");
        return filtered;
      }

      if (!filtered.some((item) => item.is_active)) {
        filtered[0] = { ...filtered[0], is_active: true };
      }
      setSelectedConfigId(filtered[0].id);
      return filtered;
    });

    onDeleteClose();
    markApiDirty();
    setListFeedback({ type: "success", message: "配置已删除，请点击“保存 API 配置”提交" });
  };

  const handleSaveApiSettings = async () => {
    setApiSaving(true);
    setApiSaveError("");
    setListFeedback(null);

    const { normalizedConfigs, activeConfig } = normalizeApiConfigsForSave(apiConfigs);

    const getProviderConfig = (providerId: string) =>
      normalizedConfigs.find((item) => item.provider_id === providerId) || null;

    const deepseekConfig = getProviderConfig("deepseek");
    const openaiConfig = getProviderConfig("openai");
    const qwenConfig = getProviderConfig("qwen");
    const siliconflowConfig = getProviderConfig("siliconflow");
    const geminiConfig = getProviderConfig("gemini");
    const zhipuConfig = getProviderConfig("zhipu");
    const ollamaConfig = getProviderConfig("ollama");

    try {
      await updateConfig({
        llm_api_configs: normalizedConfigs,
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
        ollama_base_url: toLegacyOllamaBaseUrl(ollamaConfig?.base_url || "http://localhost:11434/v1"),
      });

      await mutate();
      setApiConfigs(normalizedConfigs);
      setSelectedConfigId(activeConfig?.id || "");
      setApiSaved(true);
      setApiDirty(false);
      setTimeout(() => setApiSaved(false), 2000);
      setListFeedback({
        type: "success",
        message: normalizedConfigs.length > 0 ? "API 配置已保存" : "API 配置已清空并保存",
      });
    } catch (error) {
      setApiSaveError(error instanceof Error ? error.message : "API 配置保存失败，请稍后重试");
    } finally {
      setApiSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsSaveError("");

    try {
      await updateConfig({
        search_keywords: searchKeywords.split("\n").map((item) => item.trim()).filter(Boolean),
        search_locations: searchLocations.split("\n").map((item) => item.trim()).filter(Boolean),
        banned_keywords: bannedKeywords.split("\n").map((item) => item.trim()).filter(Boolean),
        top_n: parseInt(topN, 10) || 15,
        email_to: emailTo.trim(),
        sources_enabled: sourcesEnabled,
        profile_source_sync_enabled: profileSourceSyncEnabled,
        boss_cookie: bossCookie.trim(),
        zhilian_cookie: zhilianCookie.trim(),
      });

      await mutate();
      setSettingsSaved(true);
      setSettingsDirty(false);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (error) {
      setSettingsSaveError(error instanceof Error ? error.message : "其他设置保存失败，请稍后重试");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6 max-w-5xl"
    >
      <h1 className="text-3xl font-bold">设置</h1>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-blue-400" />
            <h3 className="text-lg font-semibold">大模型API管理</h3>
          </div>
          <p className="text-sm text-white/50">请在此处配置您的 API 信息。新增、删除、编辑后需点击本模块的“保存 API 配置”。</p>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-white/[0.03] text-white/70">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">服务商</th>
                  <th className="px-3 py-3 text-left font-medium">模型名称</th>
                  <th className="px-3 py-3 text-left font-medium">API URL</th>
                  <th className="px-3 py-3 text-left font-medium">API密钥</th>
                  <th className="px-3 py-3 text-center font-medium">是否激活</th>
                </tr>
              </thead>
              <tbody>
                {apiConfigs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-white/40">
                      暂无配置，请点击“新增”创建第一条配置
                    </td>
                  </tr>
                )}
                {apiConfigs.map((item) => {
                  const isSelected = selectedConfigId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-white/5 cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-500/10" : "hover:bg-white/[0.02]"
                      }`}
                      onClick={() => handleRowClick(item.id)}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{item.service_name}</div>
                        <div className="text-[11px] text-white/40">{item.provider_id}</div>
                      </td>
                      <td className="px-3 py-3 text-white/80">{item.model}</td>
                      <td className="px-3 py-3 text-white/70 break-all">{item.base_url}</td>
                      <td className="px-3 py-3 text-white/70">{displayMaskedKey(item.api_key)}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name="active-llm-config"
                          checked={item.is_active}
                          onChange={() => handleActivateConfig(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={`激活 ${item.service_name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Plus size={14} />}
                onPress={openCreateEditor}
              >
                新增
              </Button>
              <Button
                size="sm"
                variant="flat"
                startContent={<Trash2 size={14} />}
                isDisabled={!selectedConfig}
                onPress={onDeleteOpen}
              >
                删除
              </Button>
              <Button
                size="sm"
                variant="flat"
                startContent={<SquarePen size={14} />}
                isDisabled={!selectedConfig}
                onPress={() => {
                  if (selectedConfig) openEditEditor(selectedConfig);
                }}
              >
                编辑
              </Button>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Chip
                size="sm"
                variant="flat"
                className={apiDirty ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/60"}
              >
                {apiDirty ? "有未保存改动" : "已同步"}
              </Chip>
              <Button
                size="sm"
                color={apiSaved ? "success" : "primary"}
                startContent={apiSaved ? <Check size={14} /> : <Save size={14} />}
                isLoading={apiSaving}
                onPress={handleSaveApiSettings}
              >
                {apiSaved ? "已保存" : "保存 API 配置"}
              </Button>
            </div>
          </div>

          {listFeedback && (
            <div
              className={`text-xs rounded-lg px-3 py-2 border ${
                listFeedback.type === "success"
                  ? "text-green-300 border-green-500/30 bg-green-500/10"
                  : "text-red-300 border-red-500/30 bg-red-500/10"
              }`}
            >
              {listFeedback.message}
            </div>
          )}

          {apiSaveError && (
            <div className="text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{apiSaveError}</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">搜索配置</h3>
          <Textarea
            label="搜索关键词（每行一个）"
            variant="bordered"
            placeholder={"Data Scientist\nPython Developer\nBioinformatics"}
            value={searchKeywords}
            onValueChange={handleSearchKeywordsChange}
          />
          <Textarea
            label="搜索地区（每行一个）"
            variant="bordered"
            placeholder={"北京\n上海\n深圳"}
            value={searchLocations}
            onValueChange={handleSearchLocationsChange}
          />
          <Textarea
            label="过滤关键词（每行一个）"
            variant="bordered"
            placeholder={"实习\nstudent\n临时"}
            value={bannedKeywords}
            onValueChange={handleBannedKeywordsChange}
          />
          <Input
            label="每日推送数量"
            variant="bordered"
            type="number"
            value={topN}
            onValueChange={handleTopNChange}
          />
        </CardBody>
      </Card>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-3">
          <h3 className="text-lg font-semibold">数据源</h3>
          {dataSources.map((source) => (
            <div key={source.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{source.label}</span>
                {!source.available && (
                  <Chip size="sm" variant="flat" className="text-[10px] bg-white/5 text-white/30">
                    COMING SOON
                  </Chip>
                )}
              </div>
              <Switch
                size="sm"
                isSelected={sourcesEnabled.includes(source.name)}
                isDisabled={!source.available}
                onValueChange={() => toggleSource(source.name)}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">档案同步</h3>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
            <div className="space-y-1">
              <p className="text-sm text-white/85">档案源数据更新时，同步更新简历中已导入的对应条目</p>
              <p className="text-xs text-white/45">
                默认关闭。开启后当档案条目被编辑时，简历编辑页会提示你手动确认是否同步；档案删除永不删除简历内容。
              </p>
            </div>
            <Switch
              size="sm"
              isSelected={profileSourceSyncEnabled}
              onValueChange={handleProfileSourceSyncChange}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">邮箱推送</h3>
          <Input
            label="接收邮箱"
            variant="bordered"
            type="email"
            value={emailTo}
            onValueChange={handleEmailToChange}
          />
        </CardBody>
      </Card>

      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <Cookie size={20} className="text-orange-400" />
            <h3 className="text-lg font-semibold">爬虫认证配置</h3>
          </div>
          <p className="text-xs text-white/40">
            部分招聘平台需要登录后的 Cookie 才能获取数据。在浏览器登录后，
            按 F12 - Network - 复制任意请求的 Cookie 字段粘贴到这里。Cookie 仅保存在本地。
          </p>

          <Input
            label="BOSS直聘 Cookie"
            variant="bordered"
            placeholder="wt2=...; zp_token=...; ..."
            description={
              bossCookie && bossCookie !== "***已配置***" && !bossCookie.includes("wt2")
                ? "Cookie 应包含 wt2 字段"
                : bossCookie === "***已配置***"
                ? "已配置，输入新值将覆盖"
                : undefined
            }
            color={
              bossCookie && bossCookie !== "***已配置***" && !bossCookie.includes("wt2")
                ? "warning"
                : undefined
            }
            value={bossCookie}
            onValueChange={handleBossCookieChange}
            type={showBossCookie ? "text" : "password"}
            endContent={
              <button
                type="button"
                onClick={() => setShowBossCookie((prev) => !prev)}
                className="text-white/30 hover:text-white/60"
              >
                {showBossCookie ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            classNames={{
              inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
            }}
          />

          <Input
            label="智联招聘 Cookie（可选）"
            variant="bordered"
            placeholder="登录 zhaopin.com 后复制 Cookie..."
            description={
              zhilianCookie === "***已配置***"
                ? "已配置，输入新值将覆盖"
                : "无 Cookie 时会尝试匿名访问"
            }
            value={zhilianCookie}
            onValueChange={handleZhilianCookieChange}
            type={showZhilianCookie ? "text" : "password"}
            endContent={
              <button
                type="button"
                onClick={() => setShowZhilianCookie((prev) => !prev)}
                className="text-white/30 hover:text-white/60"
              >
                {showZhilianCookie ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            classNames={{
              inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
            }}
          />
        </CardBody>
      </Card>

      {settingsSaveError && (
        <div className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{settingsSaveError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-white/45">
          此按钮仅保存搜索配置、数据源、邮箱推送与爬虫认证配置。
        </p>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Chip
            size="sm"
            variant="flat"
            className={settingsDirty ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/60"}
          >
            {settingsDirty ? "有未保存改动" : "已同步"}
          </Chip>
          <Button
            startContent={settingsSaved ? <Check size={16} /> : <Save size={16} />}
            color={settingsSaved ? "success" : "primary"}
            isLoading={settingsSaving}
            onPress={handleSaveSettings}
          >
            {settingsSaved ? "已保存" : "保存其他设置"}
          </Button>
        </div>
      </div>

      <Modal isOpen={isEditorOpen} onClose={onEditorClose} size="3xl" placement="center" scrollBehavior="inside">
        <ModalContent className="bg-[#1a1a2e] border border-white/10 max-h-[88vh]">
          <ModalHeader>{editingConfigId ? "编辑 API 配置" : "新增 API 配置"}</ModalHeader>
          <ModalBody className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
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
              description={
                formProviderChoice === CUSTOM_OPTION
                  ? "当前为自定义服务，可直接编辑"
                  : "左侧可直接输入，右侧可展开预设服务列表"
              }
              isInvalid={Boolean(formErrors.service_name)}
              errorMessage={formErrors.service_name}
              placeholder="例如：DeepSeek"
              selectorButtonProps={{
                size: "sm",
                variant: "flat",
                className: "min-w-8 w-8 h-8 bg-white/10",
              }}
              inputProps={{
                classNames: {
                  inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                },
              }}
              classNames={{
                base: "w-full",
                listboxWrapper: "max-h-56",
              }}
              listboxProps={{
                emptyContent: "暂无预设服务",
              }}
            >
              {providerSelectOptions.map((item) => (
                <AutocompleteItem key={item.id} textValue={item.label}>
                  <div className="flex flex-col">
                    <span>{item.label}</span>
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
                setFormModelChoice(String(key));
                setFormCustomModel("");
              }}
              description={
                formModelChoice === CUSTOM_OPTION
                  ? "当前为自定义模型，可直接编辑"
                  : "左侧可直接输入，右侧可展开预设模型列表"
              }
              isInvalid={Boolean(formErrors.model)}
              errorMessage={formErrors.model}
              placeholder="例如：deepseek-chat"
              selectorButtonProps={{
                size: "sm",
                variant: "flat",
                className: "min-w-8 w-8 h-8 bg-white/10",
              }}
              inputProps={{
                classNames: {
                  inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                },
              }}
              classNames={{
                base: "w-full",
                listboxWrapper: "max-h-56",
              }}
              listboxProps={{
                emptyContent: "暂无预设模型",
              }}
            >
              {modelSelectOptions.map((item) => (
                <AutocompleteItem key={item.id} textValue={item.label}>
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && <span className="text-xs text-white/40">{item.description}</span>}
                  </div>
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Autocomplete
              label="API URL 选择"
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
                const value = String(key);
                setFormUrlChoice(value);
                setFormBaseUrl(value);
              }}
              description={
                formUrlChoice === CUSTOM_OPTION
                  ? "当前为自定义 URL，可直接编辑"
                  : "左侧可直接输入，右侧可展开预设 URL 列表"
              }
              isInvalid={Boolean(formErrors.base_url)}
              errorMessage={formErrors.base_url}
              placeholder="https://..."
              selectorButtonProps={{
                size: "sm",
                variant: "flat",
                className: "min-w-8 w-8 h-8 bg-white/10",
              }}
              inputProps={{
                classNames: {
                  inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
                },
              }}
              classNames={{
                base: "w-full",
                listboxWrapper: "max-h-56",
              }}
              listboxProps={{
                emptyContent: "暂无预设 URL",
              }}
            >
              {urlSelectOptions.map((item) => (
                <AutocompleteItem key={item.id} textValue={item.label}>
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && <span className="text-xs text-white/40">{item.description}</span>}
                  </div>
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Input
              label="API 密钥"
              variant="bordered"
              value={formApiKey}
              onValueChange={setFormApiKey}
              placeholder={resolvedFormProviderId === "ollama" ? "Ollama 无需密钥" : "sk-..."}
              type={showFormApiKey ? "text" : "password"}
              isDisabled={resolvedFormProviderId === "ollama"}
              isInvalid={Boolean(formErrors.api_key)}
              errorMessage={formErrors.api_key}
              classNames={{
                inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
              }}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowFormApiKey((prev) => !prev)}
                  className="text-white/30 hover:text-white/60"
                >
                  {showFormApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Checkbox isSelected={formIsActive} onValueChange={setFormIsActive} className="md:col-span-2">
              设为当前激活配置
            </Checkbox>

            <Divider className="my-1 border-white/10 md:col-span-2" />
            <p className="text-xs text-white/40 md:col-span-2">
              所有字段均必填。服务名称、模型名称、API URL 均支持预设选择和手动输入。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onEditorClose}>取消</Button>
            <Button color="primary" onPress={handleSubmitEditor}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm" placement="center">
        <ModalContent className="bg-[#1a1a2e] border border-white/10">
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p className="text-sm text-white/70">
              确定删除当前配置“{selectedConfig?.service_name || "未命名配置"}”吗？此操作不可撤销。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>取消</Button>
            <Button color="danger" onPress={handleDeleteConfig}>删除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
