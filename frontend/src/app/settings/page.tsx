// =============================================
// 设置页 — 系统配置管理
// =============================================
// 多 LLM Provider 选择（DeepSeek / OpenAI / Ollama）
// 搜索关键词、数据源开关、邮箱推送
// 状态从后端 API 加载，修改后保存回后端
// =============================================

"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardBody, Input, Textarea, Switch, Button, Divider, Select, SelectItem, Chip } from "@nextui-org/react";
import { Save, Check, Sparkles, Cpu, Globe, Server, Eye, EyeOff, Key } from "lucide-react";
import { useConfig, updateConfig } from "@/lib/hooks";

const dataSources = [
  { name: "linkedin", label: "LinkedIn", available: true },
  { name: "shixiseng", label: "实习僧", available: true },
  { name: "zhilian", label: "智联招聘", available: true },
  { name: "bytedance", label: "字节跳动", available: true },
  { name: "alibaba", label: "阿里巴巴", available: true },
  { name: "tencent", label: "腾讯", available: true },
  { name: "boss", label: "BOSS直聘", available: false },
  { name: "maimai", label: "脉脉", available: false },
  { name: "guopin", label: "国聘", available: false },
];

/** Provider 图标映射 */
const providerIcons: Record<string, typeof Cpu> = {
  deepseek: Cpu,
  openai: Globe,
  ollama: Server,
};

export default function SettingsPage() {
  const { data: config, mutate } = useConfig();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 本地编辑态
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchLocations, setSearchLocations] = useState("");
  const [bannedKeywords, setBannedKeywords] = useState("");
  const [topN, setTopN] = useState("15");
  const [emailTo, setEmailTo] = useState("");
  const [sourcesEnabled, setSourcesEnabled] = useState<string[]>(["linkedin"]);
  const [llmProvider, setLlmProvider] = useState("deepseek");
  const [llmModel, setLlmModel] = useState("deepseek-chat");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // 后端返回的多 Provider 列表
  const [availableProviders, setAvailableProviders] = useState<
    { id: string; name: string; description: string; models: { id: string; name: string; description: string }[] }[]
  >([]);

  // 从 API 加载初始值
  useEffect(() => {
    if (config) {
      setSearchKeywords((config.search_keywords || []).join("\n"));
      setSearchLocations((config.search_locations || []).join("\n"));
      setBannedKeywords((config.banned_keywords || []).join("\n"));
      setTopN(String(config.top_n || 15));
      setEmailTo(config.email_to || "");
      setSourcesEnabled(config.sources_enabled || ["linkedin"]);
      setLlmProvider(config.llm_provider || "deepseek");
      setLlmModel(config.llm_model || "deepseek-chat");
      setDeepseekApiKey(config.deepseek_api_key || "");
      setOpenaiApiKey(config.openai_api_key || "");
      setOllamaBaseUrl(config.ollama_base_url || "http://localhost:11434");
      if (config.available_providers) {
        setAvailableProviders(config.available_providers);
      }
    }
  }, [config]);

  /** 当前 Provider 下可选的模型列表 */
  const currentModels = useMemo(() => {
    const provider = availableProviders.find((p) => p.id === llmProvider);
    return provider?.models || [];
  }, [availableProviders, llmProvider]);

  /** 切换 Provider 时自动选第一个模型 */
  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    const provider = availableProviders.find((p) => p.id === providerId);
    if (provider?.models?.length) {
      setLlmModel(provider.models[0].id);
    }
  };

  /** 切换数据源开关 */
  const toggleSource = (name: string) => {
    setSourcesEnabled((prev) =>
      prev.includes(name)
        ? prev.filter((s) => s !== name)
        : [...prev, name]
    );
  };

  /** 保存配置到后端 */
  const handleSave = async () => {
    setSaving(true);
    await updateConfig({
      search_keywords: searchKeywords.split("\n").filter(Boolean),
      search_locations: searchLocations.split("\n").filter(Boolean),
      banned_keywords: bannedKeywords.split("\n").filter(Boolean),
      top_n: parseInt(topN) || 15,
      email_to: emailTo,
      sources_enabled: sourcesEnabled,
      llm_provider: llmProvider,
      llm_model: llmModel,
      deepseek_api_key: deepseekApiKey.trim(),
      openai_api_key: openaiApiKey.trim(),
      ollama_base_url: ollamaBaseUrl.trim(),
    });
    await mutate();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6 max-w-3xl"
    >
      <h1 className="text-3xl font-bold">设置</h1>

      {/* AI 模型配置 — 多 Provider */}
      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400" />
            <h3 className="text-lg font-semibold">AI 模型配置</h3>
          </div>
          <p className="text-sm text-white/50">
            选择用于简历优化、JD 分析等 AI 功能的提供商和模型。
          </p>

          {/* Provider 选择（卡片式） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {availableProviders.map((provider) => {
              const Icon = providerIcons[provider.id] || Cpu;
              const isActive = llmProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className={isActive ? "text-blue-400" : "text-white/40"} />
                    <span className={`text-sm font-medium ${isActive ? "text-blue-400" : ""}`}>
                      {provider.name}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">{provider.description}</p>
                </button>
              );
            })}
          </div>

          {/* 模型选择下拉 — 仅当有模型时渲染 Select */}
          {currentModels.length > 0 && (
            <Select
              label={`${availableProviders.find((p) => p.id === llmProvider)?.name || ""} 模型`}
              variant="bordered"
              selectedKeys={[llmModel]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setLlmModel(val);
              }}
              classNames={{
                trigger: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
              }}
            >
              {currentModels.map((m) => (
                <SelectItem key={m.id} textValue={m.name}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-white/40">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          )}

          <Divider className="my-2 border-white/5" />

          {/* API Key 输入 */}
          <div className="flex items-center gap-2">
            <Key size={16} className="text-white/40" />
            <h4 className="text-sm font-medium text-white/60">API Key 配置</h4>
          </div>
          <p className="text-xs text-white/40">
            Key 保存在本地服务器，重启不丢失，不会上传到任何第三方。页面显示为脱敏值，输入新值将覆盖旧值。
          </p>

          {llmProvider === "deepseek" && (
            <Input
              label="DeepSeek API Key"
              variant="bordered"
              placeholder="sk-..."
              description={deepseekApiKey && !deepseekApiKey.includes("*") && !deepseekApiKey.startsWith("sk-") ? "DeepSeek Key 通常以 sk- 开头" : undefined}
              color={deepseekApiKey && !deepseekApiKey.includes("*") && !deepseekApiKey.startsWith("sk-") ? "warning" : undefined}
              value={deepseekApiKey}
              onValueChange={setDeepseekApiKey}
              type={showDeepseekKey ? "text" : "password"}
              endContent={
                <button type="button" onClick={() => setShowDeepseekKey(!showDeepseekKey)} className="text-white/30 hover:text-white/60">
                  {showDeepseekKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              classNames={{
                inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
              }}
            />
          )}

          {llmProvider === "openai" && (
            <Input
              label="OpenAI API Key"
              variant="bordered"
              placeholder="sk-..."
              description={openaiApiKey && !openaiApiKey.includes("*") && !openaiApiKey.startsWith("sk-") ? "OpenAI Key 通常以 sk- 开头" : undefined}
              color={openaiApiKey && !openaiApiKey.includes("*") && !openaiApiKey.startsWith("sk-") ? "warning" : undefined}
              value={openaiApiKey}
              onValueChange={setOpenaiApiKey}
              type={showOpenaiKey ? "text" : "password"}
              endContent={
                <button type="button" onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="text-white/30 hover:text-white/60">
                  {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              classNames={{
                inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
              }}
            />
          )}

          {llmProvider === "ollama" && (
            <Input
              label="Ollama 服务地址"
              variant="bordered"
              placeholder="http://localhost:11434"
              value={ollamaBaseUrl}
              onValueChange={setOllamaBaseUrl}
              classNames={{
                inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15",
              }}
            />
          )}
        </CardBody>
      </Card>

      {/* 搜索配置 */}
      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">搜索配置</h3>
          <Textarea
            label="搜索关键词（每行一个）"
            variant="bordered"
            placeholder={"Data Scientist\nPython Developer\nBioinformatics"}
            value={searchKeywords}
            onValueChange={setSearchKeywords}
          />
          <Textarea
            label="搜索地区（每行一个）"
            variant="bordered"
            placeholder={"北京\n上海\n深圳"}
            value={searchLocations}
            onValueChange={setSearchLocations}
          />
          <Textarea
            label="过滤关键词（每行一个）"
            variant="bordered"
            placeholder={"实习\nstudent\n临时"}
            value={bannedKeywords}
            onValueChange={setBannedKeywords}
          />
          <Input
            label="每日推送数量"
            variant="bordered"
            type="number"
            value={topN}
            onValueChange={setTopN}
          />
        </CardBody>
      </Card>

      {/* 数据源开关 */}
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

      {/* 邮箱配置 */}
      <Card className="bg-white/5 border border-white/10">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">邮箱推送</h3>
          <Input
            label="接收邮箱"
            variant="bordered"
            type="email"
            value={emailTo}
            onValueChange={setEmailTo}
          />
        </CardBody>
      </Card>

      <Button
        startContent={saved ? <Check size={16} /> : <Save size={16} />}
        color={saved ? "success" : "primary"}
        className="w-full"
        isLoading={saving}
        onPress={handleSave}
      >
        {saved ? "已保存" : "保存设置"}
      </Button>
    </motion.div>
  );
}
