"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Database,
  Download,
  Eye,
  EyeOff,
  Key,
  Plus,
  RefreshCw,
  Save,
  SquarePen,
  Trash2,
  Upload,
} from "lucide-react";
import {
  cleanupLocalData,
  getLocalExportUrl,
  importLocalData,
  useConfig,
  useLocalStatus,
  updateConfig,
} from "@/lib/hooks";

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

  active_llm_summary?: {
    provider_id: string;
    service_name: string;
    model: string;
    base_url: string;
    source: "active_config" | "legacy_env" | "ollama";
  };

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

const bauhausFieldClassNames = {
  inputWrapper:
    "border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] group-data-[focus=true]:border-black hover:-translate-y-[1px]",
  input: "font-medium text-black placeholder:text-black/45",
  label: "font-semibold tracking-[0.06em] text-[11px] text-black/65",
  description: "text-black/55",
  errorMessage: "font-medium text-[#D02020]",
};

const bauhausModalContentClassName =
  "max-h-[88vh] border-2 border-black bg-[#F0F0F0] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]";

const bauhausAutocompleteInputClassNames = {
  ...bauhausFieldClassNames,
  inputWrapper:
    "border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] group-data-[focus=true]:border-black",
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

function displayMaskedKey(value: string): string {
  if (!value) return "";
  if (value.includes("*")) return value;
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`;
}

function formatBytes(value?: number): string {
  const bytes = value || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
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
  const { data: localStatus, mutate: refreshLocalStatus } = useLocalStatus();
  const config = data as SettingsConfigPayload | undefined;

  const [apiSaving, setApiSaving] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);
  const [apiSaveError, setApiSaveError] = useState("");
  const [apiDirty, setApiDirty] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [dataImporting, setDataImporting] = useState(false);
  const [dataCleaning, setDataCleaning] = useState(false);
  const [dataFeedback, setDataFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const dataFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportLocalData = () => {
    setDataFeedback({ type: "success", message: "正在生成数据包，浏览器会自动下载。" });
    window.location.href = getLocalExportUrl();
    window.setTimeout(() => {
      void refreshLocalStatus();
    }, 1200);
  };

  const handleImportLocalDataFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setDataImporting(true);
    setDataFeedback(null);
    try {
      const result = await importLocalData(file);
      await refreshLocalStatus();
      const imported = result.imported.length > 0 ? result.imported.join(", ") : "无可导入内容";
      setDataFeedback({
        type: "success",
        message: result.restart_recommended
          ? `已导入：${imported}。当前数据已自动备份，建议重启本地服务后继续使用。`
          : `已导入：${imported}。`,
      });
    } catch (error) {
      setDataFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "导入数据包失败",
      });
    } finally {
      setDataImporting(false);
    }
  };

  const handleCleanupLocalData = async () => {
    const ok = window.confirm("只会清理临时导入包和临时文件，不会删除简历、岗位和配置。继续吗？");
    if (!ok) return;

    setDataCleaning(true);
    setDataFeedback(null);
    try {
      const result = await cleanupLocalData();
      await refreshLocalStatus();
      setDataFeedback({
        type: "success",
        message: `已清理 ${result.files} 个文件，释放 ${formatBytes(result.bytes)}。`,
      });
    } catch (error) {
      setDataFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "清理临时数据失败",
      });
    } finally {
      setDataCleaning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6"
    >
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 border-b-2 border-black p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#1040C0] text-white">System Controls</span>
            <div>
              <p className="bauhaus-label text-black/60">Search, Sources, Models</p>
              <h1 className="mt-2 text-4xl font-black uppercase tracking-[-0.08em] md:text-6xl">
                Tune
                <br />
                Route
                <br />
                Save
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                在这里配置模型供应商、搜索规则、数据源和同步策略。所有模块延续同一套 Bauhaus 视觉规范，但保持原有配置逻辑不变。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
              <p className="bauhaus-label text-white/70">API Configs</p>
              <p className="mt-2 text-4xl font-black uppercase tracking-[-0.08em]">{apiConfigs.length}</p>
              <p className="mt-2 text-sm font-medium text-white/80">当前已维护的模型供应商配置数量。</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
              <p className="bauhaus-label text-black/60">Sources</p>
              <p className="mt-2 text-4xl font-black uppercase tracking-[-0.08em]">{sourcesEnabled.length}</p>
              <p className="mt-2 text-sm font-medium text-black/75">当前启用的数据抓取来源数。</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
              <p className="bauhaus-label text-white/70">Unsaved</p>
              <p className="mt-2 text-4xl font-black uppercase tracking-[-0.08em]">
                {Number(apiDirty) + Number(settingsDirty)}
              </p>
              <p className="mt-2 text-sm font-medium text-white/80">需要提交到本地配置文件的待保存模块数。</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <div className="bauhaus-panel-sm flex h-11 w-11 items-center justify-center bg-[#1040C0] text-white">
                <Database size={18} />
              </div>
              <div>
                <p className="bauhaus-label text-black/55">Local Data</p>
                <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-black">本地数据中心</h3>
              </div>
            </div>
            <Button
              size="sm"
              startContent={<RefreshCw size={14} />}
              onPress={() => refreshLocalStatus()}
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
            >
              刷新状态
            </Button>
          </div>

          <div className="bauhaus-panel-sm bg-[#F0F0F0] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/45">数据目录</p>
            <p className="mt-1 break-all text-sm font-medium text-black">
              {localStatus?.data_dir || "正在读取本地数据目录..."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "数据库", value: formatBytes(localStatus?.database.size), ok: localStatus?.database.exists },
              { label: "配置文件", value: formatBytes(localStatus?.config.size), ok: localStatus?.config.exists },
              { label: "上传文件", value: formatBytes(localStatus?.uploads.size), ok: localStatus?.uploads.exists },
              { label: "备份包", value: formatBytes(localStatus?.backups.size), ok: true },
            ].map((item) => (
              <div key={item.label} className="bauhaus-panel-sm bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/45">{item.label}</p>
                  <span className={`h-2 w-2 rounded-full ${item.ok ? "bg-[#20A060]" : "bg-[#D02020]"}`} />
                </div>
                <p className="mt-2 text-lg font-black tracking-[-0.04em] text-black">{item.value}</p>
              </div>
            ))}
          </div>

          <input
            ref={dataFileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleImportLocalDataFile}
          />

          <div className="flex flex-col gap-2 md:flex-row">
            <Button
              startContent={<Download size={16} />}
              onPress={handleExportLocalData}
              className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
            >
              导出数据包
            </Button>
            <Button
              startContent={<Upload size={16} />}
              isLoading={dataImporting}
              onPress={() => dataFileInputRef.current?.click()}
              className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]"
            >
              添加数据包
            </Button>
            <Button
              startContent={<Trash2 size={16} />}
              isLoading={dataCleaning}
              onPress={handleCleanupLocalData}
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
            >
              清理临时数据
            </Button>
          </div>

          {dataFeedback && (
            <div
              className={`bauhaus-panel-sm px-3 py-3 text-xs font-medium ${
                dataFeedback.type === "success" ? "bg-[#F0C020] text-black" : "bg-[#D02020] text-white"
              }`}
            >
              {dataFeedback.message}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-5 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="bauhaus-panel-sm flex h-11 w-11 items-center justify-center bg-[#1040C0] text-white">
              <Key size={18} />
            </div>
            <div>
              <p className="bauhaus-label text-black/55">Model Providers</p>
              <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-black">大模型 API 管理</h3>
            </div>
          </div>
          <p className="text-sm font-medium leading-relaxed text-black/65">
            请在此处配置您的 API 信息。新增、删除、编辑后，仍需点击本模块底部的“保存 API 配置”完成提交。
          </p>

          {/* 当前生效配置摘要 (PRD §7.1 Req 4) */}
          {config?.active_llm_summary && (
            <div className="bauhaus-panel-sm bg-[#1040C0] px-4 py-4 text-sm text-white">
              <div className="mb-1 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  config.active_llm_summary.source === "active_config" ? "bg-green-400" :
                  config.active_llm_summary.source === "ollama" ? "bg-yellow-400" : "bg-orange-400"
                }`} />
                <span className="font-medium text-white/90">当前生效配置</span>
                <Chip
                  size="sm"
                  variant="flat"
                  className="border-2 border-black bg-white text-black"
                  color={
                  config.active_llm_summary.source === "active_config" ? "success" :
                  config.active_llm_summary.source === "ollama" ? "warning" : "danger"
                }
                >
                  {config.active_llm_summary.source === "active_config" ? "已激活配置" :
                   config.active_llm_summary.source === "ollama" ? "本地 Ollama" : "旧配置回退"}
                </Chip>
              </div>
              <div className="ml-4 grid grid-cols-1 gap-x-6 gap-y-1 text-white/70 sm:grid-cols-3">
                <span>服务商: <span className="text-white">{config.active_llm_summary.service_name}</span></span>
                <span>模型: <span className="text-white">{config.active_llm_summary.model}</span></span>
                <span className="truncate">URL: <span className="text-white">{config.active_llm_summary.base_url}</span></span>
              </div>
            </div>
          )}

          <div className="bauhaus-panel-sm overflow-x-auto bg-[#F0F0F0]">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-[#121212] text-white">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold tracking-[0.06em]">服务商</th>
                  <th className="px-3 py-3 text-left font-semibold tracking-[0.06em]">模型名称</th>
                  <th className="px-3 py-3 text-left font-semibold tracking-[0.06em]">API URL</th>
                  <th className="px-3 py-3 text-left font-semibold tracking-[0.06em]">API密钥</th>
                  <th className="px-3 py-3 text-center font-semibold tracking-[0.06em]">是否激活</th>
                </tr>
              </thead>
              <tbody>
                {apiConfigs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center font-medium text-black/55">
                      暂无配置，请点击“新增”创建第一条配置
                    </td>
                  </tr>
                )}
                {apiConfigs.map((item) => {
                  const isSelected = selectedConfigId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`cursor-pointer border-t-2 border-black/10 transition-colors ${
                        isSelected ? "bg-[#F0C020]" : "bg-white hover:bg-[#F0F0F0]"
                      }`}
                      onClick={() => handleRowClick(item.id)}
                    >
                      <td className="px-3 py-3">
                        <div className="font-bold text-black">{item.service_name}</div>
                        <div className="text-[11px] font-medium tracking-[0.04em] text-black/45">{item.provider_id}</div>
                      </td>
                      <td className="px-3 py-3 text-black/80">{item.model}</td>
                      <td className="px-3 py-3 break-all text-black/72">{item.base_url}</td>
                      <td className="px-3 py-3 text-black/72">{displayMaskedKey(item.api_key)}</td>
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
                startContent={<Plus size={14} />}
                onPress={openCreateEditor}
                className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
              >
                新增
              </Button>
              <Button
                size="sm"
                startContent={<Trash2 size={14} />}
                isDisabled={!selectedConfig}
                onPress={onDeleteOpen}
                className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
              >
                删除
              </Button>
              <Button
                size="sm"
                startContent={<SquarePen size={14} />}
                isDisabled={!selectedConfig}
                onPress={() => {
                  if (selectedConfig) openEditEditor(selectedConfig);
                }}
                className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
              >
                编辑
              </Button>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Chip
                size="sm"
                variant="flat"
                className={
                  apiDirty
                    ? "border-2 border-black bg-[#F0C020] text-black"
                    : "border-2 border-black bg-white text-black/60"
                }
              >
                {apiDirty ? "有未保存改动" : "已同步"}
              </Chip>
              <Button
                size="sm"
                startContent={apiSaved ? <Check size={14} /> : <Save size={14} />}
                isLoading={apiSaving}
                onPress={handleSaveApiSettings}
                className={`bauhaus-button !px-4 !py-3 !text-[11px] ${
                  apiSaved ? "bauhaus-button-yellow" : "bauhaus-button-red"
                }`}
              >
                {apiSaved ? "已保存" : "保存 API 配置"}
              </Button>
            </div>
          </div>

          {listFeedback && (
            <div
              className={`bauhaus-panel-sm px-3 py-3 text-xs font-medium ${
                listFeedback.type === "success"
                  ? "bg-[#F0C020] text-black"
                  : "bg-[#D02020] text-white"
              }`}
            >
              {listFeedback.message}
            </div>
          )}

          {apiSaveError && (
            <div className="bauhaus-panel-sm flex items-center gap-2 bg-[#D02020] px-3 py-3 text-xs font-medium text-white">
              <AlertCircle size={14} />
              <span>{apiSaveError}</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5 md:p-6">
          <div>
            <p className="bauhaus-label text-black/55">Search Rules</p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] text-black">搜索配置</h3>
          </div>
          <Textarea
            label="搜索关键词（每行一个）"
            variant="bordered"
            placeholder={"Data Scientist\nPython Developer\nBioinformatics"}
            value={searchKeywords}
            onValueChange={handleSearchKeywordsChange}
            classNames={bauhausFieldClassNames}
          />
          <Textarea
            label="搜索地区（每行一个）"
            variant="bordered"
            placeholder={"北京\n上海\n深圳"}
            value={searchLocations}
            onValueChange={handleSearchLocationsChange}
            classNames={bauhausFieldClassNames}
          />
          <Textarea
            label="过滤关键词（每行一个）"
            variant="bordered"
            placeholder={"实习\nstudent\n临时"}
            value={bannedKeywords}
            onValueChange={handleBannedKeywordsChange}
            classNames={bauhausFieldClassNames}
          />
          <Input
            label="每日推送数量"
            variant="bordered"
            type="number"
            value={topN}
            onValueChange={handleTopNChange}
            classNames={bauhausFieldClassNames}
          />
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5 md:p-6">
          <div>
            <p className="bauhaus-label text-black/55">Source Toggles</p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] text-black">数据源</h3>
          </div>
          {dataSources.map((source) => (
            <div key={source.name} className="bauhaus-panel-sm flex items-center justify-between gap-4 bg-[#F0F0F0] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-black">{source.label}</span>
                {!source.available && (
                  <Chip size="sm" variant="flat" className="border-2 border-black bg-white text-[10px] text-black/55">
                    COMING SOON
                  </Chip>
                )}
              </div>
              <Switch
                size="sm"
                isSelected={sourcesEnabled.includes(source.name)}
                isDisabled={!source.available}
                onValueChange={() => toggleSource(source.name)}
                classNames={{ wrapper: "bg-black/10" }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5 md:p-6">
          <div>
            <p className="bauhaus-label text-black/55">Resume Sync</p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] text-black">档案同步</h3>
          </div>
          <div className="bauhaus-panel-sm flex items-start justify-between gap-4 bg-[#F0F0F0] px-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-black">档案源数据更新时，同步更新简历中已导入的对应条目</p>
              <p className="text-xs font-medium leading-relaxed text-black/55">
                默认关闭。开启后当档案条目被编辑时，简历编辑页会提示你手动确认是否同步；档案删除永不删除简历内容。
              </p>
            </div>
            <Switch
              size="sm"
              isSelected={profileSourceSyncEnabled}
              onValueChange={handleProfileSourceSyncChange}
              classNames={{ wrapper: "bg-black/10" }}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5 md:p-6">
          <div>
            <p className="bauhaus-label text-black/55">Delivery</p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] text-black">邮箱推送</h3>
          </div>
          <Input
            label="接收邮箱"
            variant="bordered"
            type="email"
            value={emailTo}
            onValueChange={handleEmailToChange}
            classNames={bauhausFieldClassNames}
          />
        </CardBody>
      </Card>

      <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="bauhaus-panel-sm flex h-11 w-11 items-center justify-center bg-[#F0C020] text-black">
              <Cookie size={18} />
            </div>
            <div>
              <p className="bauhaus-label text-black/55">Crawler Access</p>
              <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-black">爬虫认证配置</h3>
            </div>
          </div>
          <p className="text-xs font-medium leading-relaxed text-black/55">
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
                className="text-black/35 hover:text-black/70"
                aria-label={showBossCookie ? "隐藏 Cookie" : "显示 Cookie"}
                aria-pressed={showBossCookie}
              >
                {showBossCookie ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            classNames={bauhausFieldClassNames}
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
                className="text-black/35 hover:text-black/70"
                aria-label={showZhilianCookie ? "隐藏 Cookie" : "显示 Cookie"}
                aria-pressed={showZhilianCookie}
              >
                {showZhilianCookie ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            classNames={bauhausFieldClassNames}
          />
        </CardBody>
      </Card>

      {settingsSaveError && (
        <div className="bauhaus-panel-sm flex items-center gap-2 bg-[#D02020] px-3 py-3 text-sm font-medium text-white">
          <AlertCircle size={16} />
          <span>{settingsSaveError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-medium text-black/55">
          此按钮仅保存搜索配置、数据源、邮箱推送与爬虫认证配置。
        </p>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Chip
            size="sm"
            variant="flat"
            className={
              settingsDirty
                ? "border-2 border-black bg-[#F0C020] text-black"
                : "border-2 border-black bg-white text-black/60"
            }
          >
            {settingsDirty ? "有未保存改动" : "已同步"}
          </Chip>
          <Button
            startContent={settingsSaved ? <Check size={16} /> : <Save size={16} />}
            isLoading={settingsSaving}
            onPress={handleSaveSettings}
            className={`bauhaus-button !px-4 !py-3 !text-[11px] ${
              settingsSaved ? "bauhaus-button-yellow" : "bauhaus-button-blue"
            }`}
          >
            {settingsSaved ? "已保存" : "保存其他设置"}
          </Button>
        </div>
      </div>

      <Modal isOpen={isEditorOpen} onClose={onEditorClose} size="3xl" placement="center" scrollBehavior="inside">
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black px-6 py-5 text-xl font-black tracking-[-0.06em]">
            {editingConfigId ? "编辑 API 配置" : "新增 API 配置"}
          </ModalHeader>
          <ModalBody className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2">
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
                className: "min-h-10 h-10 w-10 min-w-10 border-2 border-black bg-[#F0C020] text-black",
              }}
              inputProps={{
                classNames: bauhausAutocompleteInputClassNames,
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
                    <span className="font-medium text-black">{item.label}</span>
                    {item.description && <span className="text-xs text-black/45">{item.description}</span>}
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
                className: "min-h-10 h-10 w-10 min-w-10 border-2 border-black bg-[#F0C020] text-black",
              }}
              inputProps={{
                classNames: bauhausAutocompleteInputClassNames,
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
                    <span className="font-medium text-black">{item.label}</span>
                    {item.description && <span className="text-xs text-black/45">{item.description}</span>}
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
                className: "min-h-10 h-10 w-10 min-w-10 border-2 border-black bg-[#F0C020] text-black",
              }}
              inputProps={{
                classNames: bauhausAutocompleteInputClassNames,
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
                    <span className="font-medium text-black">{item.label}</span>
                    {item.description && <span className="text-xs text-black/45">{item.description}</span>}
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
              classNames={bauhausFieldClassNames}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowFormApiKey((prev) => !prev)}
                  className="text-black/35 hover:text-black/70"
                  aria-label={showFormApiKey ? "隐藏 API Key" : "显示 API Key"}
                  aria-pressed={showFormApiKey}
                >
                  {showFormApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Checkbox isSelected={formIsActive} onValueChange={setFormIsActive} className="md:col-span-2">
              设为当前激活配置
            </Checkbox>

            <Divider className="my-1 border-black/10 md:col-span-2" />
            <p className="text-xs font-medium text-black/55 md:col-span-2">
              所有字段均必填。服务名称、模型名称、API URL 均支持预设选择和手动输入。
            </p>
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button
              variant="light"
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
              onPress={onEditorClose}
            >
              取消
            </Button>
            <Button
              className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
              onPress={handleSubmitEditor}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm" placement="center">
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black bg-[#F0C020] px-6 py-5 text-xl font-black tracking-[-0.06em]">
            确认删除
          </ModalHeader>
          <ModalBody className="px-6 py-6">
            <p className="text-sm font-medium leading-relaxed text-black/72">
              确定删除当前配置“{selectedConfig?.service_name || "未命名配置"}”吗？此操作不可撤销。
            </p>
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button
              variant="light"
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
              onPress={onDeleteClose}
            >
              取消
            </Button>
            <Button
              className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
              onPress={handleDeleteConfig}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
