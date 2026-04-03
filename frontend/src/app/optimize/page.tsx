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
  Target, BarChart3, ShieldAlert, PenLine, ArrowUpDown, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  useResumes, aiOptimizeResume, aiOptimizeText, parseResumeFile, AiOptimizeResult,
  aiAnalyzeResume, aiAnalyzeText, SkillAnalyzeResult, RewriteSuggestion, aiApplyBatch,
} from "@/lib/hooks";

export default function OptimizePage() {
  // 模式切换：select（选择已有简历） / paste（粘贴文本）
  const [mode, setMode] = useState<string>("select");
  const { data: resumes } = useResumes();
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<AiOptimizeResult | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<SkillAnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  // 分析模式：optimize = 旧的优化建议，analyze = 新 Skill Pipeline 深度分析
  const [analysisMode, setAnalysisMode] = useState<string>("analyze");
  // HITL: 跟踪用户确认/拒绝的建议索引
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

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
    setAnalyzeResult(null);
    setAcceptedSuggestions(new Set());
    setRejectedSuggestions(new Set());
    setExpandedSuggestion(null);
    setApplyResult(null);
    try {
      if (analysisMode === "analyze") {
        // Skill Pipeline 深度分析
        let res: SkillAnalyzeResult;
        if (mode === "select" && selectedResumeId) {
          res = await aiAnalyzeResume(selectedResumeId, { jd_text: jdText.trim() });
        } else {
          res = await aiAnalyzeText({
            resume_text: resumeText.trim(),
            jd_text: jdText.trim(),
          });
        }
        setAnalyzeResult(res);
      } else {
        // 旧版优化建议
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
      }
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
        <h1 className="text-3xl font-bold">AI 简历分析</h1>
        <p className="text-white/40 text-sm mt-1">
          选择已有简历 + 粘贴目标 JD → 深度分析（JD 解析 + ATS 评分 + 匹配度）或生成优化建议
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

      {/* 分析模式选择 + 按钮 */}
      <div className="flex flex-col items-center gap-3">
        <Tabs
          size="sm"
          variant="light"
          color="secondary"
          selectedKey={analysisMode}
          onSelectionChange={(key) => setAnalysisMode(key as string)}
          classNames={{
            tabList: "gap-0 bg-white/5 rounded-lg p-0.5",
            tab: "px-4 py-1.5 text-xs",
            cursor: "bg-white/10",
          }}
        >
          <Tab
            key="analyze"
            title={
              <div className="flex items-center gap-1.5">
                <Target size={13} />
                <span>深度分析</span>
              </div>
            }
          />
          <Tab
            key="optimize"
            title={
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} />
                <span>优化建议</span>
              </div>
            }
          />
        </Tabs>
        <Button
          color="secondary"
          size="lg"
          startContent={analysisMode === "analyze" ? <Target size={18} /> : <Sparkles size={18} />}
          isLoading={loading}
          isDisabled={!canSubmit}
          onPress={handleOptimize}
          className="px-8"
        >
          {analysisMode === "analyze" ? "开始深度分析" : "开始 AI 优化"}
        </Button>
        <p className="text-[10px] text-white/25">
          {analysisMode === "analyze"
            ? "Skill Pipeline: JD 解析 → ATS 评分 → 逐段匹配 → 风险检测"
            : "单次 AI 优化: 关键词匹配 + 逐条优化建议"}
        </p>
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

      {/* ===== Pipeline 深度分析结果 ===== */}
      <AnimatePresence>
        {analyzeResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <Divider className="border-white/[0.06]" />

            {/* 顶部: ATS 评分 + JD 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ATS 总分 */}
              {analyzeResult.match_analysis && (
                <Card className="bg-white/[0.02] border border-white/[0.06]">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-purple-400" />
                      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        ATS 综合评分
                      </h4>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className={`text-5xl font-bold ${
                        analyzeResult.match_analysis.ats_score >= 70 ? "text-emerald-400"
                        : analyzeResult.match_analysis.ats_score >= 40 ? "text-amber-400"
                        : "text-red-400"
                      }`}>
                        {analyzeResult.match_analysis.ats_score}
                      </div>
                      <span className="text-sm text-white/40 mb-2">/ 100</span>
                    </div>
                    <Progress
                      value={analyzeResult.match_analysis.ats_score}
                      maxValue={100}
                      color={
                        analyzeResult.match_analysis.ats_score >= 70 ? "success"
                        : analyzeResult.match_analysis.ats_score >= 40 ? "warning"
                        : "danger"
                      }
                      size="sm"
                    />
                    {analyzeResult.match_analysis.summary && (
                      <p className="text-xs text-white/50 leading-relaxed mt-1">
                        {analyzeResult.match_analysis.summary}
                      </p>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* JD 信息卡 */}
              {analyzeResult.jd_analysis && (
                <Card className="bg-white/[0.02] border border-white/[0.06] md:col-span-2">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-blue-400" />
                      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        JD 解析
                      </h4>
                      {analyzeResult.jd_analysis.is_campus && (
                        <Chip size="sm" variant="flat" className="bg-blue-500/10 text-blue-300 text-[10px] h-5">
                          校招岗位
                        </Chip>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-semibold text-white/80">
                        {analyzeResult.jd_analysis.job_title || "未识别"}
                      </span>
                      {analyzeResult.jd_analysis.company && (
                        <span className="text-sm text-white/40">
                          @ {analyzeResult.jd_analysis.company}
                        </span>
                      )}
                      {analyzeResult.jd_analysis.experience_level && (
                        <Chip size="sm" variant="flat" className="bg-white/5 text-white/40 text-[10px] h-5">
                          {analyzeResult.jd_analysis.experience_level}
                        </Chip>
                      )}
                    </div>
                    {analyzeResult.jd_analysis.required_skills?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 uppercase font-semibold">必须技能</span>
                        <div className="flex flex-wrap gap-1">
                          {analyzeResult.jd_analysis.required_skills.map((s, i) => (
                            <Chip key={i} size="sm" variant="flat" className="bg-red-500/10 text-red-300 text-[10px] h-5">
                              {s}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                    {analyzeResult.jd_analysis.preferred_skills?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 uppercase font-semibold">加分技能</span>
                        <div className="flex flex-wrap gap-1">
                          {analyzeResult.jd_analysis.preferred_skills.map((s, i) => (
                            <Chip key={i} size="sm" variant="flat" className="bg-yellow-500/10 text-yellow-300 text-[10px] h-5">
                              {s}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}
            </div>

            {/* 中部: 技能匹配对比 */}
            {analyzeResult.match_analysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 已匹配技能 */}
                {analyzeResult.match_analysis.matched_skills?.length > 0 && (
                  <Card className="bg-white/[0.02] border border-white/[0.06]">
                    <CardBody className="p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-400/60 uppercase tracking-wider">
                        ✓ 已匹配 ({analyzeResult.match_analysis.matched_skills.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analyzeResult.match_analysis.matched_skills.map((s, i) => (
                          <Chip key={i} size="sm" variant="flat" className="bg-emerald-500/10 text-emerald-300 text-[10px] h-5">
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* 缺失技能 */}
                {analyzeResult.match_analysis.missing_skills?.length > 0 && (
                  <Card className="bg-white/[0.02] border border-white/[0.06]">
                    <CardBody className="p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-orange-400/60 uppercase tracking-wider">
                        ✗ 缺失 ({analyzeResult.match_analysis.missing_skills.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analyzeResult.match_analysis.missing_skills.map((s, i) => (
                          <Chip key={i} size="sm" variant="flat" className="bg-orange-500/10 text-orange-300 text-[10px] h-5">
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {/* 下部: 逐段评分 + 风险项 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 逐段评分 */}
              {analyzeResult.match_analysis?.section_scores?.length > 0 && (
                <Card className="bg-white/[0.02] border border-white/[0.06] md:col-span-2">
                  <CardBody className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      逐段评分
                    </h4>
                    <div className="space-y-3">
                      {analyzeResult.match_analysis.section_scores.map((sec, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/60 font-medium">{sec.section}</span>
                            <span className={`text-xs font-bold ${
                              sec.score >= 70 ? "text-emerald-400"
                              : sec.score >= 40 ? "text-amber-400"
                              : "text-red-400"
                            }`}>
                              {sec.score}
                            </span>
                          </div>
                          <Progress
                            value={sec.score}
                            maxValue={100}
                            size="sm"
                            color={sec.score >= 70 ? "success" : sec.score >= 40 ? "warning" : "danger"}
                          />
                          {sec.feedback && (
                            <p className="text-[11px] text-white/35">{sec.feedback}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* 风险项 */}
              {analyzeResult.match_analysis?.risk_items?.length > 0 && (
                <Card className="bg-white/[0.02] border border-red-500/10">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={14} className="text-red-400" />
                      <h4 className="text-xs font-semibold text-red-400/60 uppercase tracking-wider">
                        风险项 ({analyzeResult.match_analysis.risk_items.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {analyzeResult.match_analysis.risk_items.map((risk, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-300/70">
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-red-400/50" />
                          <span>{
                            risk === "no_contact" ? "未提供联系方式" :
                            risk === "no_gpa" ? "未填写 GPA / 学业成绩" :
                            risk === "too_long" ? "简历篇幅过长" :
                            risk === "no_quantified" ? "缺少量化数据支撑" :
                            risk === "vague_description" ? "描述过于笼统模糊" :
                            risk
                          }</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* ===== HITL: 内容改写建议 ===== */}
            {(analyzeResult.content_rewrite?.suggestions?.length ?? 0) > 0 && (
              <Card className="bg-white/[0.02] border border-white/[0.06]">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PenLine size={14} className="text-blue-400" />
                      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        内容优化建议 ({analyzeResult.content_rewrite!.suggestions.length})
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                      <span className="text-emerald-400">已采纳 {acceptedSuggestions.size}</span>
                      <span>/</span>
                      <span className="text-red-400">已拒绝 {rejectedSuggestions.size}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {analyzeResult.content_rewrite!.suggestions.map((sug, idx) => {
                      const isExpanded = expandedSuggestion === idx;
                      const isAccepted = acceptedSuggestions.has(idx);
                      const isRejected = rejectedSuggestions.has(idx);
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-3 transition-all ${
                            isAccepted ? "border-emerald-500/30 bg-emerald-500/5" :
                            isRejected ? "border-red-500/20 bg-red-500/5 opacity-50" :
                            "border-white/[0.06] hover:border-white/10"
                          }`}
                        >
                          {/* 建议头部 */}
                          <button
                            className="w-full flex items-center justify-between text-left"
                            onClick={() => setExpandedSuggestion(isExpanded ? null : idx)}
                          >
                            <div className="flex items-center gap-2">
                              <Chip
                                size="sm"
                                variant="flat"
                                className={
                                  sug.type === "inject"
                                    ? "bg-purple-500/10 text-purple-300 text-[10px]"
                                    : "bg-blue-500/10 text-blue-300 text-[10px]"
                                }
                              >
                                {sug.type === "inject" ? "关键词注入" : "经历改写"}
                              </Chip>
                              <span className="text-[11px] text-white/40">
                                {sug.section_title}{sug.item_label ? ` · ${sug.item_label}` : ""}
                              </span>
                              {sug.injected_keywords?.length > 0 && (
                                <span className="text-[10px] text-purple-300/60">
                                  +{sug.injected_keywords.join(", ")}
                                </span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                          </button>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="mt-3 space-y-2">
                              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                                <span className="text-[10px] text-red-400/60 uppercase font-semibold">原文</span>
                                <p className="text-xs text-white/50 mt-1">{sug.original}</p>
                              </div>
                              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                                <span className="text-[10px] text-emerald-400/60 uppercase font-semibold">建议</span>
                                <p className="text-xs text-white/70 mt-1">{sug.suggested}</p>
                              </div>
                              <p className="text-[11px] text-white/35 italic">{sug.reason}</p>

                              {/* HITL 操作按钮 */}
                              {!isAccepted && !isRejected && (
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    className="bg-emerald-500/10 text-emerald-300 text-[11px]"
                                    startContent={<Check size={12} />}
                                    onPress={() => {
                                      setAcceptedSuggestions(prev => new Set(prev).add(idx));
                                      setExpandedSuggestion(null);
                                    }}
                                  >
                                    采纳
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    className="bg-red-500/10 text-red-300 text-[11px]"
                                    onPress={() => {
                                      setRejectedSuggestions(prev => new Set(prev).add(idx));
                                      setExpandedSuggestion(null);
                                    }}
                                  >
                                    拒绝
                                  </Button>
                                </div>
                              )}
                              {isAccepted && (
                                <div className="flex items-center gap-1 text-[11px] text-emerald-400/60">
                                  <Check size={12} /> 已采纳
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ===== 模块重排建议 ===== */}
            {analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error && analyzeResult.section_reorder.changes?.length > 0 && (
              <Card className="bg-white/[0.02] border border-white/[0.06]">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-amber-400" />
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      模块排序建议
                    </h4>
                  </div>

                  {analyzeResult.section_reorder.reason && (
                    <p className="text-xs text-white/50">{analyzeResult.section_reorder.reason}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 当前顺序 */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">当前顺序</span>
                      <div className="space-y-1">
                        {analyzeResult.section_reorder.current_order?.map((sec, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.02] rounded-lg px-3 py-1.5 border border-white/[0.04]">
                            <span className="text-white/25 text-[10px] w-4">{i + 1}</span>
                            {sec}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 建议顺序 */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-amber-400/60 uppercase font-semibold">建议顺序</span>
                      <div className="space-y-1">
                        {analyzeResult.section_reorder.suggested_order?.map((sec, i) => {
                          const change = analyzeResult.section_reorder?.changes?.find(c => c.section === sec);
                          return (
                            <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border ${
                              change?.action === "move_up" ? "text-emerald-300 bg-emerald-500/5 border-emerald-500/10" :
                              change?.action === "move_down" ? "text-amber-300 bg-amber-500/5 border-amber-500/10" :
                              "text-white/50 bg-white/[0.02] border-white/[0.04]"
                            }`}>
                              <span className="text-white/25 text-[10px] w-4">{i + 1}</span>
                              {sec}
                              {change?.action === "move_up" && <ChevronUp size={12} className="text-emerald-400/60 ml-auto" />}
                              {change?.action === "move_down" && <ChevronDown size={12} className="text-amber-400/60 ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 详细变更理由 */}
                  {analyzeResult.section_reorder.changes.filter(c => c.action !== "keep").length > 0 && (
                    <div className="space-y-1 pt-1">
                      {analyzeResult.section_reorder.changes.filter(c => c.action !== "keep").map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-white/40">
                          <ArrowRight size={10} className="mt-0.5 flex-shrink-0 text-amber-400/50" />
                          <span><span className="text-white/60">{c.section}</span>: {c.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {/* ===== 一键应用 ===== */}
            {mode === "select" && selectedResumeId && (
              acceptedSuggestions.size > 0 ||
              (analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error && (analyzeResult.section_reorder.suggested_order?.length ?? 0) > 0)
            ) && (
              <Card className="bg-white/[0.02] border border-emerald-500/20">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-white/60">
                        一键应用到简历
                      </h4>
                      <p className="text-[11px] text-white/35">
                        {acceptedSuggestions.size > 0 && `${acceptedSuggestions.size} 条内容建议`}
                        {acceptedSuggestions.size > 0 && analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error && " + "}
                        {analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error && "模块重排"}
                      </p>
                      {applyResult && (
                        <p className="text-[11px] text-emerald-400/80 mt-1">{applyResult}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      className="text-[11px] font-semibold"
                      startContent={<Check size={14} />}
                      isLoading={applying}
                      isDisabled={applying || (acceptedSuggestions.size === 0 && !(analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error))}
                      onPress={async () => {
                        if (!selectedResumeId) return;
                        setApplying(true);
                        setApplyResult(null);
                        try {
                          const acceptedList = analyzeResult.content_rewrite?.suggestions?.filter((_, idx) => acceptedSuggestions.has(idx)) || [];
                          const hasReorder = analyzeResult.section_reorder && !(analyzeResult.section_reorder as any).error;
                          const result = await aiApplyBatch(selectedResumeId, {
                            suggestions: acceptedList,
                            ...(hasReorder && analyzeResult.section_reorder?.suggested_order
                              ? { reorder: { suggested_order: analyzeResult.section_reorder.suggested_order } }
                              : {}),
                          });
                          setApplyResult(result.message);
                        } catch (err: any) {
                          setApplyResult(`应用失败: ${err.message}`);
                        } finally {
                          setApplying(false);
                        }
                      }}
                    >
                      应用已采纳建议
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
