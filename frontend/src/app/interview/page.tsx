// =============================================
// 面经题库页 — 面经收集 + 问题提炼 + 回答生成
// =============================================
// 功能：
//   - 手动粘贴面经原文（P0 零风险）
//   - LLM 提炼结构化问题
//   - 基于 Profile 生成推荐回答思路
//   - 按公司/岗位/类型筛选题库
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card, CardBody, CardHeader, Button, Chip, Tabs, Tab,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Input, useDisclosure, Spinner, Accordion, AccordionItem,
} from "@nextui-org/react";
import {
  GraduationCap, Plus, Sparkles, Search,
  ChevronDown, MessageSquare, Building2, Briefcase,
} from "lucide-react";
import {
  useInterviewQuestions, useInterviewExperiences,
  collectExperience, extractQuestions, generateAnswer,
} from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const categoryConfig: Record<string, { label: string; color: "default" | "primary" | "warning" | "success" | "danger" | "secondary" }> = {
  behavioral: { label: "行为类", color: "primary" },
  technical: { label: "技术类", color: "warning" },
  case: { label: "案例类", color: "secondary" },
  motivation: { label: "动机类", color: "success" },
};

const roundConfig: Record<string, string> = {
  hr: "HR面",
  department: "业务面",
  final: "终面",
};

export default function InterviewPage() {
  // 筛选状态
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("questions");

  // 数据 hooks
  const { data: questions, mutate: mutateQuestions } = useInterviewQuestions(
    categoryFilter === "all"
      ? (companyFilter ? { company: companyFilter } : undefined)
      : { category: categoryFilter, ...(companyFilter ? { company: companyFilter } : {}) }
  );
  const { data: experiences, mutate: mutateExperiences } = useInterviewExperiences(
    companyFilter || undefined
  );

  // 新增面经弹窗
  const { isOpen: isCollectOpen, onOpen: onCollectOpen, onClose: onCollectClose } = useDisclosure();
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newRawText, setNewRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 提炼 + 生成状态
  const [extractingId, setExtractingId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [answerMap, setAnswerMap] = useState<Record<number, string>>({});

  /** 提交面经 */
  const handleCollect = async () => {
    if (!newCompany.trim() || !newRole.trim() || !newRawText.trim()) return;
    setSubmitting(true);
    try {
      const result = await collectExperience({
        company: newCompany.trim(),
        role: newRole.trim(),
        raw_text: newRawText.trim(),
      });
      // 自动提炼
      setExtractingId(result.id);
      try {
        await extractQuestions(result.id);
      } catch {
        // 提炼失败不阻塞
      }
      setExtractingId(null);
      mutateExperiences();
      mutateQuestions();
      onCollectClose();
      setNewCompany("");
      setNewRole("");
      setNewRawText("");
    } catch (e: any) {
      alert(e.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  /** 手动提炼某条面经 */
  const handleExtract = async (expId: number) => {
    setExtractingId(expId);
    try {
      await extractQuestions(expId);
      mutateQuestions();
    } catch (e: any) {
      alert(e.message || "提炼失败");
    } finally {
      setExtractingId(null);
    }
  };

  /** 生成推荐回答 */
  const handleGenerateAnswer = async (qId: number) => {
    setGeneratingId(qId);
    try {
      const result = await generateAnswer(qId);
      setAnswerMap((prev) => ({ ...prev, [qId]: result.suggested_answer }));
      mutateQuestions();
    } catch (e: any) {
      alert(e.message || "生成失败");
    } finally {
      setGeneratingId(null);
    }
  };

  const difficultyStars = (d: number) => "★".repeat(d) + "☆".repeat(5 - d);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* 页面标题 */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">面经题库</h1>
          <p className="text-white/50 mt-1">收集面经 → AI提炼问题 → 生成回答思路</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={16} />}
          onPress={onCollectOpen}
        >
          粘贴面经
        </Button>
      </motion.div>

      {/* 搜索 + 筛选 */}
      <motion.div variants={item} className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="搜索公司..."
          size="sm"
          variant="bordered"
          className="max-w-[200px]"
          startContent={<Search size={14} />}
          value={companyFilter}
          onValueChange={setCompanyFilter}
        />
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as string)}
          size="sm"
        >
          <Tab key="questions" title={`题库 (${questions?.length ?? 0})`} />
          <Tab key="experiences" title={`面经 (${experiences?.length ?? 0})`} />
        </Tabs>
      </motion.div>

      {/* 类型筛选 Chips（仅题库 tab） */}
      {activeTab === "questions" && (
        <motion.div variants={item} className="flex gap-2 flex-wrap">
          <Chip
            variant={categoryFilter === "all" ? "solid" : "flat"}
            className="cursor-pointer"
            onClick={() => setCategoryFilter("all")}
          >
            全部
          </Chip>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <Chip
              key={key}
              color={cfg.color}
              variant={categoryFilter === key ? "solid" : "flat"}
              className="cursor-pointer"
              onClick={() => setCategoryFilter(key)}
            >
              {cfg.label}
            </Chip>
          ))}
        </motion.div>
      )}

      {/* 题库列表 */}
      {activeTab === "questions" && (
        <div className="space-y-3">
          {questions && questions.length > 0 ? (
            questions.map((q) => {
              const cfg = categoryConfig[q.category] || categoryConfig.behavioral;
              const answer = answerMap[q.id] || q.suggested_answer;
              return (
                <motion.div key={q.id} variants={item}>
                  <Card className="bg-white/5 border border-white/10">
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-blue-200">{q.question_text}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Chip size="sm" color={cfg.color} variant="flat">{cfg.label}</Chip>
                            <Chip size="sm" variant="flat">{roundConfig[q.round_type] || q.round_type}</Chip>
                            <span className="text-xs text-yellow-400">{difficultyStars(q.difficulty)}</span>
                            {q.frequency > 1 && (
                              <Chip size="sm" variant="flat" color="danger">
                                出现{q.frequency}次
                              </Chip>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          color="secondary"
                          startContent={generatingId === q.id ? <Spinner size="sm" /> : <Sparkles size={14} />}
                          isDisabled={generatingId === q.id}
                          onPress={() => handleGenerateAnswer(q.id)}
                        >
                          {answer ? "重新生成" : "生成回答"}
                        </Button>
                      </div>

                      {/* 回答展示 */}
                      {answer && (
                        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1 text-xs text-purple-300 mb-2">
                            <MessageSquare size={12} />
                            推荐回答思路
                          </div>
                          <p className="text-sm text-white/80 whitespace-pre-wrap">{answer}</p>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <motion.div variants={item}>
              <Card className="bg-white/5 border border-white/10">
                <CardBody className="p-8 text-center text-white/40">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">题库为空</p>
                  <p className="text-sm">点击右上角"粘贴面经"添加你的第一条面经，AI 会自动提炼问题</p>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* 面经列表 */}
      {activeTab === "experiences" && (
        <div className="space-y-3">
          {experiences && experiences.length > 0 ? (
            experiences.map((exp) => (
              <motion.div key={exp.id} variants={item}>
                <Card className="bg-white/5 border border-white/10">
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-blue-300" />
                          <span className="font-semibold">{exp.company}</span>
                          <span className="text-white/40">·</span>
                          <Briefcase size={14} className="text-purple-300" />
                          <span>{exp.role}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                          <span>来源: {exp.source_platform}</span>
                          {exp.collected_at && (
                            <span>{new Date(exp.collected_at).toLocaleDateString("zh-CN")}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        color="warning"
                        startContent={extractingId === exp.id ? <Spinner size="sm" /> : <Sparkles size={14} />}
                        isDisabled={extractingId === exp.id}
                        onPress={() => handleExtract(exp.id)}
                      >
                        提炼问题
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))
          ) : (
            <motion.div variants={item}>
              <Card className="bg-white/5 border border-white/10">
                <CardBody className="p-8 text-center text-white/40">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">暂无面经</p>
                  <p className="text-sm">点击右上角"粘贴面经"开始收集</p>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* 新增面经 Modal */}
      <Modal isOpen={isCollectOpen} onClose={onCollectClose} size="2xl" placement="center">
        <ModalContent className="bg-[#1a1a2e] border border-white/10">
          <ModalHeader className="flex items-center gap-2">
            <GraduationCap size={20} />
            粘贴面经原文
          </ModalHeader>
          <ModalBody>
            <div className="flex gap-3">
              <Input
                label="公司"
                placeholder="如：字节跳动"
                variant="bordered"
                value={newCompany}
                onValueChange={setNewCompany}
                className="flex-1"
              />
              <Input
                label="岗位"
                placeholder="如：前端开发"
                variant="bordered"
                value={newRole}
                onValueChange={setNewRole}
                className="flex-1"
              />
            </div>
            <Textarea
              label="面经原文"
              placeholder="将面经原文粘贴到这里，AI 会自动提炼出面试问题...&#10;&#10;示例：&#10;一面（技术面 45min）：&#10;1. 自我介绍&#10;2. 说说你做过的项目中最有挑战的部分&#10;3. 讲讲 React 的 diff 算法原理&#10;..."
              variant="bordered"
              minRows={8}
              maxRows={16}
              value={newRawText}
              onValueChange={setNewRawText}
            />
            <p className="text-xs text-white/30">
              提交后 AI 将自动提炼面试问题，耗时约 10-20 秒
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onCollectClose}>取消</Button>
            <Button
              color="primary"
              isLoading={submitting}
              isDisabled={!newCompany.trim() || !newRole.trim() || !newRawText.trim()}
              onPress={handleCollect}
            >
              提交并提炼
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
