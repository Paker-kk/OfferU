// =============================================
// ProfileOnboarding — 5步 Profile 冷启动向导
// =============================================
// Step 1: 基础信息表单 (姓名/学校/专业/学位/GPA/邮箱/电话)
// Step 2: 目标岗位选择 (多选 + 自定义 + fit_level)
// Step 2.5: 即时价值钩子 (3段经历 → AI秒出简历框架)
// Step 3-4: AI 对话引导 (进入主 Profile 页面)
// Step 5: 职业叙事总结 (headline + exit_story)
// =============================================

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardBody,
  Chip,
  Select,
  SelectItem,
  Spinner,
} from "@nextui-org/react";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Target,
  Zap,
  MessageSquare,
  Sparkles,
  X,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { profileApi } from "@/lib/api";

interface ProfileOnboardingProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 5;

// 预设岗位标签
const PRESET_ROLES = [
  "运营", "市场", "产品", "行政", "教育",
  "BD", "HR", "财务", "内容", "策划",
];

const FIT_LEVELS = [
  { value: "primary", label: "首选" },
  { value: "secondary", label: "次选" },
  { value: "adjacent", label: "相关" },
];

// 动画变体
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 1: 基础信息
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [degree, setDegree] = useState("本科");
  const [gpa, setGpa] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: 目标岗位
  const [selectedRoles, setSelectedRoles] = useState<
    { title: string; fit_level: string }[]
  >([]);
  const [customRole, setCustomRole] = useState("");

  // Step 2.5: 即时价值
  const [experiences, setExperiences] = useState(["", "", ""]);
  const [generating, setGenerating] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);

  // Step 5: 叙事
  const [headline, setHeadline] = useState("");
  const [exitStory, setExitStory] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  // 全局
  const [saving, setSaving] = useState(false);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  // Step 1 → 保存基础信息
  const handleSaveBasic = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        name: name.trim(),
        base_info_json: {
          email: email.trim(),
          phone: phone.trim(),
          school: school.trim(),
          major: major.trim(),
          degree,
          gpa: gpa.trim(),
        },
      });
      goNext();
    } catch {
      // 允许继续
      goNext();
    } finally {
      setSaving(false);
    }
  };

  // Step 2 → 保存目标岗位
  const handleSaveRoles = async () => {
    setSaving(true);
    try {
      for (const role of selectedRoles) {
        await profileApi.addTargetRole(role);
      }
      goNext();
    } catch {
      goNext();
    } finally {
      setSaving(false);
    }
  };

  // 添加岗位
  const toggleRole = (title: string) => {
    setSelectedRoles((prev) => {
      const exists = prev.find((r) => r.title === title);
      if (exists) return prev.filter((r) => r.title !== title);
      return [...prev, { title, fit_level: "primary" }];
    });
  };

  const addCustomRole = () => {
    if (!customRole.trim()) return;
    const t = customRole.trim();
    if (!selectedRoles.find((r) => r.title === t)) {
      setSelectedRoles((prev) => [
        ...prev,
        { title: t, fit_level: "primary" },
      ]);
    }
    setCustomRole("");
  };

  const updateFitLevel = (title: string, level: string) => {
    setSelectedRoles((prev) =>
      prev.map((r) => (r.title === title ? { ...r, fit_level: level } : r))
    );
  };

  // Step 2.5 → 即时草稿
  const handleInstantDraft = async () => {
    const filled = experiences.filter((e) => e.trim());
    if (filled.length === 0) return;
    setGenerating(true);
    try {
      await profileApi.instantDraft({ experiences: filled });
      setDraftGenerated(true);
    } catch {
      // 允许继续
    } finally {
      setGenerating(false);
    }
  };

  // Step 5 → 生成叙事
  const handleGenerateNarrative = async () => {
    setNarrativeLoading(true);
    try {
      const result: any = await profileApi.generateNarrative();
      if (result.headline) setHeadline(result.headline);
      if (result.exit_story) setExitStory(result.exit_story);
    } catch {
      // ignore
    } finally {
      setNarrativeLoading(false);
    }
  };

  // 完成向导
  const handleFinish = async () => {
    setSaving(true);
    try {
      // 保存叙事到 Profile
      if (headline || exitStory) {
        await profileApi.update({ headline, exit_story: exitStory });
      }
      onComplete();
    } catch {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        {/* 进度条 */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step
                  ? "bg-blue-500 w-12"
                  : "bg-white/10 w-8"
              }`}
            />
          ))}
          <span className="text-xs text-white/30 ml-2">
            {step + 1}/{TOTAL_STEPS}
          </span>
        </div>

        {/* Step Content */}
        <Card className="bg-white/5 border border-white/10 overflow-hidden">
          <CardBody className="p-8">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 0 && (
                <StepWrapper key="s0" dir={direction}>
                  <StepHeader
                    icon={User}
                    title="基础信息"
                    subtitle="让我们先了解你的基本情况"
                  />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <Input
                      label="姓名"
                      isRequired
                      value={name}
                      onValueChange={setName}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Input
                      label="学校"
                      isRequired
                      value={school}
                      onValueChange={setSchool}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Input
                      label="专业"
                      isRequired
                      value={major}
                      onValueChange={setMajor}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Select
                      label="学位"
                      selectedKeys={[degree]}
                      onSelectionChange={(keys) => {
                        const v = Array.from(keys)[0] as string;
                        if (v) setDegree(v);
                      }}
                      variant="bordered"
                      classNames={inputClasses}
                    >
                      <SelectItem key="本科">本科</SelectItem>
                      <SelectItem key="硕士">硕士</SelectItem>
                      <SelectItem key="博士">博士</SelectItem>
                      <SelectItem key="大专">大专</SelectItem>
                    </Select>
                    <Input
                      label="GPA (可选)"
                      value={gpa}
                      onValueChange={setGpa}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Input
                      label="邮箱"
                      isRequired
                      type="email"
                      value={email}
                      onValueChange={setEmail}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Input
                      label="电话"
                      isRequired
                      value={phone}
                      onValueChange={setPhone}
                      variant="bordered"
                      classNames={inputClasses}
                      className="col-span-2 sm:col-span-1"
                    />
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button
                      color="primary"
                      endContent={<ArrowRight size={16} />}
                      isLoading={saving}
                      isDisabled={!name.trim() || !school.trim() || !major.trim()}
                      onPress={handleSaveBasic}
                    >
                      下一步
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 1 && (
                <StepWrapper key="s1" dir={direction}>
                  <StepHeader
                    icon={Target}
                    title="目标岗位"
                    subtitle="选择你感兴趣的岗位类型（可多选）"
                  />
                  {/* 预设标签 */}
                  <div className="flex flex-wrap gap-2 mt-6">
                    {PRESET_ROLES.map((role) => {
                      const selected = selectedRoles.some(
                        (r) => r.title === role
                      );
                      return (
                        <Chip
                          key={role}
                          variant={selected ? "solid" : "bordered"}
                          color={selected ? "primary" : "default"}
                          className="cursor-pointer"
                          onClick={() => toggleRole(role)}
                        >
                          {role}
                        </Chip>
                      );
                    })}
                  </div>

                  {/* 自定义输入 */}
                  <div className="flex gap-2 mt-4">
                    <Input
                      size="sm"
                      placeholder="输入其他岗位..."
                      value={customRole}
                      onValueChange={setCustomRole}
                      onKeyDown={(e) => e.key === "Enter" && addCustomRole()}
                      variant="bordered"
                      classNames={inputClasses}
                    />
                    <Button
                      size="sm"
                      isIconOnly
                      variant="flat"
                      onPress={addCustomRole}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>

                  {/* Fit Level 设定 */}
                  {selectedRoles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-white/40">
                        为每个岗位设置匹配度（可选）:
                      </p>
                      {selectedRoles.map((role) => (
                        <div
                          key={role.title}
                          className="flex items-center gap-3"
                        >
                          <Chip
                            variant="flat"
                            onClose={() => toggleRole(role.title)}
                          >
                            {role.title}
                          </Chip>
                          <div className="flex gap-1">
                            {FIT_LEVELS.map((fl) => (
                              <Chip
                                key={fl.value}
                                size="sm"
                                variant={
                                  role.fit_level === fl.value
                                    ? "solid"
                                    : "bordered"
                                }
                                color={
                                  role.fit_level === fl.value
                                    ? "primary"
                                    : "default"
                                }
                                className="cursor-pointer text-xs"
                                onClick={() =>
                                  updateFitLevel(role.title, fl.value)
                                }
                              >
                                {fl.label}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <Button
                      variant="light"
                      startContent={<ArrowLeft size={16} />}
                      onPress={goBack}
                    >
                      上一步
                    </Button>
                    <Button
                      color="primary"
                      endContent={<ArrowRight size={16} />}
                      isLoading={saving}
                      isDisabled={selectedRoles.length === 0}
                      onPress={handleSaveRoles}
                    >
                      下一步
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 2 && (
                <StepWrapper key="s2" dir={direction}>
                  <StepHeader
                    icon={Zap}
                    title="快速预览简历"
                    subtitle="分享你的 3 段经历（随便聊，AI 会理解）"
                  />
                  <div className="space-y-3 mt-6">
                    {experiences.map((exp, i) => (
                      <Textarea
                        key={i}
                        label={`经历 ${i + 1}`}
                        placeholder={
                          i === 0
                            ? "例: 在字节跳动实习3个月，做短视频剪辑"
                            : i === 1
                            ? "例: 参加过创业比赛，做了产品经理"
                            : "例: 在学生会外联部拉了5万赞助"
                        }
                        value={exp}
                        onValueChange={(v) =>
                          setExperiences((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          })
                        }
                        minRows={2}
                        variant="bordered"
                        classNames={inputClasses}
                      />
                    ))}
                  </div>

                  {/* AI 秒出简历框架 */}
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    {draftGenerated ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-medium">
                          已为你生成简历框架！完成向导后可在"简历"页查看
                        </span>
                      </div>
                    ) : (
                      <Button
                        color="primary"
                        variant="flat"
                        startContent={
                          generating ? (
                            <Spinner size="sm" />
                          ) : (
                            <Zap size={16} />
                          )
                        }
                        isDisabled={
                          generating ||
                          experiences.every((e) => !e.trim())
                        }
                        onPress={handleInstantDraft}
                        className="w-full"
                      >
                        {generating
                          ? "AI 正在分析你的经历..."
                          : "⚡ AI 秒出简历框架"}
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button
                      variant="light"
                      startContent={<ArrowLeft size={16} />}
                      onPress={goBack}
                    >
                      上一步
                    </Button>
                    <Button
                      color="primary"
                      endContent={<ArrowRight size={16} />}
                      onPress={goNext}
                    >
                      {draftGenerated ? "继续完善" : "跳过"}
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 3 && (
                <StepWrapper key="s3" dir={direction}>
                  <StepHeader
                    icon={MessageSquare}
                    title="AI 对话引导"
                    subtitle="接下来通过对话，让 AI 帮你挖掘更多经历细节"
                  />
                  <div className="mt-6 text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <MessageSquare size={28} className="text-blue-400" />
                    </div>
                    <p className="text-white/70 text-sm">
                      点击"开始对话"进入 Profile 构建页面
                    </p>
                    <p className="text-white/40 text-xs mt-2">
                      AI 会按主题（教育→实习→项目→社团→技能）逐一引导你
                    </p>
                  </div>
                  <div className="flex justify-between mt-6">
                    <Button
                      variant="light"
                      startContent={<ArrowLeft size={16} />}
                      onPress={goBack}
                    >
                      上一步
                    </Button>
                    <Button
                      color="primary"
                      endContent={<ArrowRight size={16} />}
                      onPress={goNext}
                    >
                      开始对话
                    </Button>
                  </div>
                </StepWrapper>
              )}

              {step === 4 && (
                <StepWrapper key="s4" dir={direction}>
                  <StepHeader
                    icon={Sparkles}
                    title="职业叙事"
                    subtitle="基于你的经历，生成你的职业故事"
                  />

                  <div className="mt-6 space-y-4">
                    <Button
                      variant="flat"
                      color="secondary"
                      startContent={
                        narrativeLoading ? (
                          <Spinner size="sm" />
                        ) : (
                          <Sparkles size={16} />
                        )
                      }
                      onPress={handleGenerateNarrative}
                      isDisabled={narrativeLoading}
                    >
                      {narrativeLoading
                        ? "AI 正在生成..."
                        : "🎯 AI 一键生成职业叙事"}
                    </Button>

                    <div>
                      <label className="text-xs text-white/40 mb-1 block">
                        Headline（一句话自我介绍）
                      </label>
                      <Textarea
                        value={headline}
                        onValueChange={setHeadline}
                        placeholder="运营从业者，擅长内容策略与用户增长..."
                        minRows={2}
                        variant="bordered"
                        classNames={inputClasses}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/40 mb-1 block">
                        Exit Story（你为什么选择这个方向）
                      </label>
                      <Textarea
                        value={exitStory}
                        onValueChange={setExitStory}
                        placeholder="我热爱创意创作与用户交互..."
                        minRows={3}
                        variant="bordered"
                        classNames={inputClasses}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button
                      variant="light"
                      startContent={<ArrowLeft size={16} />}
                      onPress={goBack}
                    >
                      上一步
                    </Button>
                    <Button
                      color="success"
                      endContent={<CheckCircle2 size={16} />}
                      isLoading={saving}
                      onPress={handleFinish}
                    >
                      完成
                    </Button>
                  </div>
                </StepWrapper>
              )}
            </AnimatePresence>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}

// ---- Helper Components ----

function StepWrapper({
  children,
  dir,
}: {
  children: React.ReactNode;
  dir: number;
}) {
  return (
    <motion.div
      custom={dir}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

function StepHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
        <Icon size={20} className="text-blue-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

// 统一 Input 暗色样式
const inputClasses = {
  input: "text-white/80",
  inputWrapper: "bg-white/5 border-white/10 hover:border-white/20",
  label: "text-white/50",
};
