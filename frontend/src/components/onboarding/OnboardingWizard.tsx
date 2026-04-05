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

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
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
import { updateConfig, createResume } from "@/lib/hooks";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 4; // 0=welcome, 1=apikey, 2=resume, 3=scrape

// 预设模板
const RESUME_TEMPLATES = [
  { id: "tech", label: "技术/工程", emoji: "💻", color: "from-blue-500/20 to-cyan-500/20" },
  { id: "business", label: "商科/管理", emoji: "📊", color: "from-amber-500/20 to-orange-500/20" },
  { id: "general", label: "通用模板", emoji: "📄", color: "from-purple-500/20 to-pink-500/20" },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back

  // Step 1: API Key
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

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

  // 保存 API Key
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      await updateConfig({ deepseek_api_key: apiKey.trim() });
      setKeySaved(true);
      setTimeout(goNext, 600);
    } catch {
      // 即使失败也继续
      goNext();
    } finally {
      setSavingKey(false);
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
      const res = await createResume({
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
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto mb-2">
                  <Key size={32} className="text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold">配置 AI 能力</h2>
                <p className="text-sm text-white/40">
                  输入 DeepSeek API Key，解锁简历优化、JD 智能分析等 AI 功能
                </p>
              </div>

              <Card className="bg-white/5 border border-white/10">
                <CardBody className="space-y-4 p-5">
                  <Input
                    label="DeepSeek API Key"
                    placeholder="sk-..."
                    variant="bordered"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onValueChange={setApiKey}
                    startContent={<Key size={16} className="text-white/30" />}
                    endContent={
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="text-white/30 hover:text-white/60"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <p className="text-xs text-white/30">
                    前往{" "}
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      DeepSeek 控制台
                    </a>
                    {" "}获取 API Key。也可在设置页随时修改。
                  </p>
                </CardBody>
              </Card>

              {keySaved && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-green-400 text-sm"
                >
                  <CheckCircle2 size={16} />
                  <span>API Key 已保存！</span>
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
                    endContent={keySaved ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                    isLoading={savingKey}
                    isDisabled={!apiKey.trim()}
                    onPress={handleSaveApiKey}
                  >
                    {keySaved ? "已保存" : "保存并继续"}
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
