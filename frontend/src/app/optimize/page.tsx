// =============================================
// AI 简历优化 — 选择已有简历 + 粘贴 JD 即刻分析
// =============================================
// 从已有简历中选择 → 粘贴 JD → AI 分析匹配度 + 生成建议
// 也支持直接粘贴简历文本（快速体验模式）
// =============================================

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card, CardBody, Button, Textarea, Chip, Progress, Divider, Tabs, Tab,
} from "@nextui-org/react";
import {
  Sparkles, FileText, Briefcase, Check, AlertTriangle, ArrowRight, Upload,
} from "lucide-react";
import { useResumes, aiOptimizeResume, aiOptimizeText, parseResumeFile, AiOptimizeResult } from "@/lib/hooks";

export default function OptimizePage() {
  // 模式切换：select（选择已有简历） / paste（粘贴文本）
  const [mode, setMode] = useState<string>("select");
  const { data: resumes } = useResumes();
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<AiOptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError("");
    try {
      const result = await parseResumeFile(file);
      setResumeText(result.text);
    } catch (err: any) {
      setError(err.message || "文件解析失败");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const canSubmit = mode === "select"
    ? selectedResumeId !== null && jdText.trim().length > 0
    : resumeText.trim().length > 0 && jdText.trim().length > 0;

  const handleOptimize = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let res: AiOptimizeResult;
      if (mode === "select" && selectedResumeId) {
        res = await aiOptimizeResume(selectedResumeId, { jd_text: jdText.trim() });
      } else {
        res = await aiOptimizeText({
          resume_text: resumeText.trim(),
          jd_text: jdText.trim(),
        });
      }
      setResult(res);
    } catch (err: any) {
      setError(err.message || "分析失败");
    } finally {
      setLoading(false);
    }
  };

  const resumeList: any[] = Array.isArray(resumes) ? resumes : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold">AI 简历优化</h1>
        <p className="text-white/40 text-sm mt-1">
          选择已有简历 + 粘贴目标 JD，AI 即刻分析关键词匹配度并生成优化建议
        </p>
      </div>

      {/* 输入区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左侧：选择简历 */}
        <Card className="bg-white/[0.02] border border-white/[0.06]">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-white/70">简历</span>
              </div>
              <Tabs
                size="sm"
                variant="light"
                selectedKey={mode}
                onSelectionChange={(key) => setMode(key as string)}
                classNames={{
                  tabList: "gap-0 bg-white/5 rounded-lg p-0.5",
                  tab: "px-3 py-1 text-xs",
                  cursor: "bg-white/10",
                }}
              >
                <Tab key="select" title="选择已有" />
                <Tab key="paste" title="粘贴文本" />
              </Tabs>
            </div>

            {mode === "select" ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {resumeList.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-sm">
                    暂无简历，请先在「简历」页面创建
                  </div>
                ) : (
                  resumeList.map((resume: any) => (
                    <button
                      key={resume.id}
                      onClick={() => setSelectedResumeId(resume.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedResumeId === resume.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/80">
                          {resume.title || `简历 #${resume.id}`}
                        </span>
                        {selectedResumeId === resume.id && (
                          <Check size={14} className="text-blue-400" />
                        )}
                      </div>
                      {resume.target_position && (
                        <p className="text-[11px] text-white/30 mt-1">
                          目标: {resume.target_position}
                        </p>
                      )}
                      <p className="text-[10px] text-white/20 mt-1">
                        更新于 {new Date(resume.updated_at || resume.created_at).toLocaleDateString("zh-CN")}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      as="span"
                      size="sm"
                      variant="flat"
                      startContent={parsing ? undefined : <Upload size={14} />}
                      isLoading={parsing}
                      className="bg-white/5 text-white/60 hover:text-white/80"
                    >
                      上传 PDF/Word
                    </Button>
                  </label>
                  <span className="text-[10px] text-white/25">或直接粘贴文本</span>
                </div>
                <Textarea
                  variant="bordered"
                  placeholder="粘贴你的简历全文..."
                  minRows={10}
                  maxRows={18}
                  value={resumeText}
                  onValueChange={setResumeText}
                  classNames={{
                    inputWrapper: "bg-white/[0.02] border-white/[0.06]",
                  }}
                />
                <p className="text-[11px] text-white/25">
                  支持 .pdf / .docx 上传解析，或直接粘贴纯文本
                </p>
              </>
            )}
          </CardBody>
        </Card>

        {/* 右侧：JD */}
        <Card className="bg-white/[0.02] border border-white/[0.06]">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-purple-400" />
              <span className="text-sm font-semibold text-white/70">职位描述 (JD)</span>
            </div>
            <Textarea
              variant="bordered"
              placeholder="粘贴目标岗位的完整职位描述..."
              minRows={12}
              maxRows={20}
              value={jdText}
              onValueChange={setJdText}
              classNames={{
                inputWrapper: "bg-white/[0.02] border-white/[0.06]",
              }}
            />
            <p className="text-[11px] text-white/25">
              包含完整的岗位要求、技能需求、职责描述效果更好
            </p>
          </CardBody>
        </Card>
      </div>

      {/* 分析按钮 */}
      <div className="flex justify-center">
        <Button
          color="secondary"
          size="lg"
          startContent={<Sparkles size={18} />}
          isLoading={loading}
          isDisabled={!canSubmit}
          onPress={handleOptimize}
          className="px-8"
        >
          开始 AI 分析
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 max-w-2xl mx-auto">
          <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-300 font-medium">分析失败</p>
            <p className="text-xs text-red-300/60 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 分析结果 */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <Divider className="border-white/[0.06]" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 匹配度评分 */}
              {result.keyword_match && (
                <Card className="bg-white/[0.02] border border-white/[0.06]">
                  <CardBody className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      关键词匹配度
                    </h4>
                    <div className="flex items-end gap-2">
                      <div className="text-4xl font-bold text-white/90">
                        {result.keyword_match.score}
                      </div>
                      <span className="text-sm text-white/40 mb-1">/ 100</span>
                    </div>
                    <Progress
                      value={result.keyword_match.score}
                      maxValue={100}
                      color={result.keyword_match.score >= 70 ? "success" : result.keyword_match.score >= 40 ? "warning" : "danger"}
                      size="sm"
                    />
                    {result.keyword_match.matched.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400/60 uppercase font-semibold">
                          已匹配 ({result.keyword_match.matched.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {result.keyword_match.matched.map((kw, i) => (
                            <Chip key={i} size="sm" variant="flat" className="bg-emerald-500/10 text-emerald-300 text-[10px] h-5">
                              {kw}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* 缺失关键词 */}
              {result.keyword_match?.missing && result.keyword_match.missing.length > 0 && (
                <Card className="bg-white/[0.02] border border-white/[0.06]">
                  <CardBody className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      缺失关键词
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keyword_match.missing.map((kw, i) => (
                        <Chip key={i} size="sm" variant="flat" className="bg-orange-500/10 text-orange-300 text-xs">
                          {kw}
                        </Chip>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* 总结 */}
              {result.summary && (
                <Card className="bg-white/[0.02] border border-white/[0.06]">
                  <CardBody className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      优化总结
                    </h4>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {result.summary}
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* 逐条建议 */}
            <Card className="bg-white/[0.02] border border-white/[0.06]">
              <CardBody className="p-4 space-y-3">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  优化建议 ({result.suggestions.length})
                </h4>
                <div className="space-y-3">
                  {result.suggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/[0.06] p-4 space-y-2 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          variant="flat"
                          className={
                            sug.type === "bullet_rewrite"
                              ? "bg-blue-500/10 text-blue-300"
                              : sug.type === "keyword_add"
                              ? "bg-purple-500/10 text-purple-300"
                              : "bg-amber-500/10 text-amber-300"
                          }
                        >
                          {sug.type === "bullet_rewrite"
                            ? "经历改写"
                            : sug.type === "keyword_add"
                            ? "关键词补充"
                            : "模块排序"}
                        </Chip>
                        {sug.item_label && (
                          <span className="text-[11px] text-white/40">
                            {sug.section_title} · {sug.item_label}
                          </span>
                        )}
                      </div>

                      {sug.original && (
                        <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                          <span className="text-[10px] text-red-400/60 uppercase font-semibold">原文</span>
                          <p className="text-xs text-white/50 mt-1">
                            {typeof sug.original === "string" ? sug.original : JSON.stringify(sug.original)}
                          </p>
                        </div>
                      )}
                      {sug.suggested && (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                          <span className="text-[10px] text-emerald-400/60 uppercase font-semibold">建议</span>
                          <p className="text-xs text-white/70 mt-1">
                            {typeof sug.suggested === "string" ? sug.suggested : JSON.stringify(sug.suggested)}
                          </p>
                        </div>
                      )}

                      {sug.reason && (
                        <p className="text-[11px] text-white/35 italic">{sug.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
