"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Chip, Input, ScrollShadow, Textarea } from "@nextui-org/react";
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useSWRConfig } from "swr";
import { bauhausFieldClassNames } from "@/lib/bauhaus";
import { profileApi, type ProfileAgentPatch } from "@/lib/api";

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function compactJsonPreview(value?: Record<string, any>) {
  const normalized = value?.normalized && typeof value.normalized === "object" ? value.normalized : value;
  return Object.entries(normalized || {})
    .filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      return item !== undefined && item !== null && String(item).trim() !== "";
    })
    .slice(0, 4)
    .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(", ") : String(item)}`)
    .join(" · ");
}

function stopReasonLabel(stopReason: string) {
  if (stopReason === "needs_user_confirmation") return "等待确认";
  if (stopReason === "needs_more_input") return "继续追问";
  if (stopReason === "finished") return "已完成";
  return "建档模式";
}

export function ProfileAgentDock() {
  const { mutate } = useSWRConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [jobGoal, setJobGoal] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "把社招简历和目标岗位给我，我会先建一版档案，再围绕缺口继续追问。",
    },
  ]);
  const [patch, setPatch] = useState<ProfileAgentPatch | null>(null);
  const [stopReason, setStopReason] = useState("");
  const [traceCount, setTraceCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const canStart = useMemo(
    () => Boolean(file || resumeText.trim() || targetRole.trim() || jobGoal.trim()),
    [file, jobGoal, resumeText, targetRole]
  );

  const pushMessage = (role: AgentMessage["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${prev.length}`,
        role,
        content,
      },
    ]);
  };

  const refreshProfile = () => {
    mutate((key) => typeof key === "string" && key.includes("/api/profile/"));
  };

  const applyAgentResponse = (result: {
    session_id: number;
    patch: ProfileAgentPatch;
    assistant_message?: string;
    agent_trace?: Record<string, any>[];
    stop_reason?: string;
  }) => {
    setSessionId(result.session_id);
    setPatch(result.patch);
    setStopReason(result.stop_reason || "");
    setTraceCount(result.agent_trace?.length || 0);
    pushMessage("assistant", result.assistant_message || result.patch.next_question || "我继续整理了一版候选信息。");
  };

  const startAgent = async () => {
    if (!canStart || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await profileApi.startProfileAgent({
        file,
        resume_text: resumeText,
        target_role: targetRole,
        target_city: targetCity,
        job_goal: jobGoal,
      });
      applyAgentResponse(result);
    } catch (err: any) {
      setError(err.message || "AI 建档启动失败");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message?: string) => {
    const content = (message ?? input).trim();
    if (!content || loading) return;
    if (!sessionId) {
      setError("请先上传简历或填写目标岗位，启动建档会话。");
      return;
    }
    setInput("");
    setLoading(true);
    setError("");
    pushMessage("user", content);
    try {
      const result = await profileApi.sendProfileAgentMessage({
        session_id: sessionId,
        message: content,
      });
      applyAgentResponse(result);
    } catch (err: any) {
      setError(err.message || "AI 回复失败");
    } finally {
      setLoading(false);
    }
  };

  const applyPatch = async () => {
    if (!sessionId || !patch || applying) return;
    setApplying(true);
    setError("");
    try {
      await profileApi.applyProfileAgentPatch({ session_id: sessionId, patch });
      refreshProfile();
      pushMessage("assistant", "已写入个人档案。你可以继续补充经历，我会接着追问缺口。");
      setPatch(null);
      setStopReason("needs_more_input");
    } catch (err: any) {
      setError(err.message || "写入档案失败");
    } finally {
      setApplying(false);
    }
  };

  const resetSession = () => {
    setSessionId(null);
    setPatch(null);
    setFile(null);
    setResumeText("");
    setInput("");
    setError("");
    setStopReason("");
    setTraceCount(0);
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content: "重新开始。把简历和目标岗位给我，我来建档。",
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {open && (
        <section className="bauhaus-panel flex h-[min(82dvh,720px)] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden bg-white">
          <header className="border-b border-black/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="bauhaus-panel-sm flex h-12 w-12 shrink-0 items-center justify-center bg-[#F0C020] text-black">
                  <Bot size={22} />
                </div>
                <div className="min-w-0">
                  <p className="bauhaus-label text-black/55">AI Workspace</p>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.05em] text-black">
                    AI 求职助手
                  </h2>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="收起 AI 助手"
                  className="text-black"
                  onPress={() => setOpen(false)}
                >
                  <ChevronDown size={17} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="重置 AI 助手"
                  className="text-black"
                  onPress={resetSession}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[var(--surface-muted)] px-3 py-2 text-black">
                Profile 建档
              </Chip>
              <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[#F0C020] px-3 py-2 text-black">
                Harness Loop
              </Chip>
              <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[#F7E4E1] px-3 py-2 text-black">
                {stopReasonLabel(stopReason)}
              </Chip>
              {traceCount > 0 && (
                <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-white px-3 py-2 text-black">
                  {traceCount} 步
                </Chip>
              )}
            </div>
          </header>

          <ScrollShadow className="flex-1 overflow-y-auto p-4">
            {!sessionId && (
              <div className="bauhaus-panel-sm mb-4 space-y-3 bg-white p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    size="sm"
                    label="目标岗位"
                    value={targetRole}
                    onValueChange={setTargetRole}
                    variant="bordered"
                    classNames={bauhausFieldClassNames}
                  />
                  <Input
                    size="sm"
                    label="目标城市"
                    value={targetCity}
                    onValueChange={setTargetCity}
                    variant="bordered"
                    classNames={bauhausFieldClassNames}
                  />
                </div>
                <Input
                  size="sm"
                  label="求职偏好"
                  value={jobGoal}
                  onValueChange={setJobGoal}
                  variant="bordered"
                  classNames={bauhausFieldClassNames}
                />
                <Textarea
                  minRows={2}
                  maxRows={4}
                  label="粘贴简历文本"
                  value={resumeText}
                  onValueChange={setResumeText}
                  variant="bordered"
                  classNames={bauhausFieldClassNames}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="light"
                    startContent={<Upload size={15} />}
                    onPress={() => fileInputRef.current?.click()}
                    className="bauhaus-button bauhaus-button-outline !min-h-10 !min-w-0 !justify-start !px-3 !py-2 !text-xs"
                  >
                    <span className="max-w-40 truncate">{file ? file.name : "上传简历"}</span>
                  </Button>
                  <Button
                    isDisabled={!canStart}
                    isLoading={loading}
                    onPress={startAgent}
                    className="bauhaus-button bauhaus-button-yellow !min-h-10 !px-3 !py-2 !text-xs"
                  >
                    开始建档
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message) => (
                <DockMessageBubble key={message.id} message={message} />
              ))}
              {loading && (
                <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-3 text-[15px] font-medium text-black/65 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]">
                  <Loader2 size={13} className="animate-spin" />
                  <span>AI 正在整理...</span>
                </div>
              )}
            </div>

            {patch && (
              <div className="bauhaus-panel-sm mt-4 space-y-3 bg-[#F9F3DC] p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-black">
                  <FileText size={16} />
                  <span>待确认写入</span>
                </div>
                {Object.keys(patch.base_info || {}).length > 0 && (
                  <div className="border-2 border-black bg-white px-3 py-2 text-xs leading-relaxed text-black/70">
                    基础信息：{compactJsonPreview(patch.base_info)}
                  </div>
                )}
                {patch.target_roles?.length > 0 && (
                  <div className="border-2 border-black bg-white px-3 py-2 text-xs leading-relaxed text-black/70">
                    目标岗位：{patch.target_roles.join("、")}
                  </div>
                )}
                <div className="space-y-2">
                  {patch.sections?.map((section, index) => (
                    <div key={`${section.title}-${index}`} className="border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0_0_rgba(18,18,18,0.18)]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-black">{section.title}</p>
                        <span className="shrink-0 text-[11px] font-semibold text-black/45">
                          {Math.round((section.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-black/60">
                        {compactJsonPreview(section.content_json) || section.section_type}
                      </p>
                    </div>
                  ))}
                </div>
                {patch.next_question && (
                  <p className="text-xs font-medium leading-relaxed text-black/60">下一步：{patch.next_question}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    startContent={<Check size={15} />}
                    isLoading={applying}
                    onPress={applyPatch}
                    className="bauhaus-button bauhaus-button-red !min-h-10 !px-3 !py-2 !text-xs"
                  >
                    确认写入
                  </Button>
                  <Button
                    variant="light"
                    onPress={() => sendMessage("请继续追问我还缺什么信息")}
                    isDisabled={loading}
                    className="bauhaus-button bauhaus-button-outline !min-h-10 !px-3 !py-2 !text-xs"
                  >
                    继续追问
                  </Button>
                </div>
              </div>
            )}
          </ScrollShadow>

          {error && <div className="border-t border-black/10 bg-[#D02020] px-4 py-2 text-xs font-medium text-white">{error}</div>}

          <footer className="bauhaus-panel-sm border-x-0 border-b-0 bg-white p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onValueChange={setInput}
                minRows={1}
                maxRows={3}
                placeholder="补充经历、成果数据或求职偏好"
                variant="bordered"
                className="flex-1"
                classNames={bauhausFieldClassNames}
                isDisabled={!sessionId || loading}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                isIconOnly
                aria-label="发送给 AI 建档助手"
                isDisabled={!sessionId || !input.trim() || loading}
                onPress={() => sendMessage()}
                className="bauhaus-button bauhaus-button-red !mb-[2px] !min-h-11 !min-w-11 !px-0 !py-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          </footer>
        </section>
      )}

      <Button
        isIconOnly
        aria-label="打开 AI 求职助手"
        className="h-14 w-14 border-2 border-black bg-[#F0C020] text-black shadow-[3px_3px_0_0_rgba(18,18,18,0.25)]"
        onPress={() => setOpen((prev) => !prev)}
      >
        {open ? <X size={22} /> : <Bot size={24} />}
      </Button>
    </div>
  );
}

function DockMessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black ${
          isUser ? "bg-[#D02020] text-white" : "bg-[#F0C020] text-black"
        }`}
      >
        {isUser ? <User size={15} /> : <Sparkles size={15} />}
      </div>

      <div className={`max-w-[86%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap border-2 border-black px-3.5 py-3 text-sm font-medium leading-6 shadow-[3px_3px_0_0_rgba(18,18,18,0.24)] ${
            isUser ? "bg-[#F7E4E1] text-black" : "bg-white text-black"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
