"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  ScrollShadow,
  Textarea,
} from "@nextui-org/react";
import {
  Bot,
  Briefcase,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  harnessAgentApi,
  type HarnessAgentCareerPath,
  type HarnessAgentJobCard,
  type HarnessAgentMessage,
  type HarnessAgentProposedAction,
  type HarnessAgentResponse,
} from "@/lib/api";
import { bauhausFieldClassNames } from "@/lib/bauhaus";

interface DockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: HarnessAgentResponse;
}

const QUICK_ACTIONS = [
  {
    label: "职业探索",
    prompt: "参考我的档案，给我 5 个意想不到但适合我的职业方向",
  },
  {
    label: "匹配岗位",
    prompt: "帮我看看现在岗位库里适合投哪些岗位",
  },
  {
    label: "投递推进",
    prompt: "帮我梳理投递管理里下一步该跟进什么",
  },
  {
    label: "面试日程",
    prompt: "帮我检查邮件通知和面试日程",
  },
];

function previewJson(value: unknown) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 260 ? `${text.slice(0, 260)}...` : text;
  } catch {
    return String(value);
  }
}

function toApiMessages(messages: DockMessage[]): HarnessAgentMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function HarnessAgentDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DockMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "我是 OfferU Harness Agent，可以帮你串起档案、岗位、简历、投递和面试推进。",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingActions, setPendingActions] = useState<HarnessAgentProposedAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPendingActions = pendingActions.length > 0;

  const sendMessage = async (text?: string, confirmedActionIds?: string[]) => {
    const content = (text ?? input).trim();
    const isConfirmation = Boolean(confirmedActionIds?.length);
    if ((!content && !isConfirmation) || loading) return;

    const userMessage: DockMessage | null = isConfirmation
      ? null
      : {
          id: `user-${Date.now()}`,
          role: "user",
          content,
        };
    const nextMessages = userMessage ? [...messages, userMessage] : messages;

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await harnessAgentApi.chat({
        messages: toApiMessages(nextMessages),
        confirmed_action_ids: confirmedActionIds,
      });
      const assistantMessage: DockMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.assistant_message,
        response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPendingActions(response.proposed_actions || []);
    } catch (err: any) {
      setError(err.message || "Harness Agent 请求失败");
    } finally {
      setLoading(false);
    }
  };

  const confirmPendingActions = () => {
    sendMessage("", pendingActions.map((action) => action.id));
  };

  const latestMode = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.response?.mode);
    return latest?.response?.mode || "ready";
  }, [messages]);

  if (!open) {
    return (
      <Button
        isIconOnly
        aria-label="打开 OfferU Harness Agent"
        title="打开 OfferU Harness Agent"
        onPress={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-50 h-14 w-14 border-2 border-black bg-[#F0C020] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.35)] md:bottom-6"
      >
        <Bot size={22} />
      </Button>
    );
  }

  return (
    <section className="fixed bottom-24 right-4 z-50 flex max-h-[78vh] w-[min(92vw,440px)] flex-col overflow-hidden border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(18,18,18,0.35)] md:bottom-6 md:right-6">
      <header className="flex items-center justify-between border-b-2 border-black bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-[#F0C020] text-black">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <p className="bauhaus-label text-[10px] text-black/50">Harness Loop</p>
            <h2 className="truncate text-base font-black text-black">OfferU 全局助手</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" className="border border-black bg-white text-[10px] font-semibold text-black">
            {latestMode}
          </Chip>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="关闭助手"
            onPress={() => setOpen(false)}
            className="min-w-8 text-black"
          >
            <X size={16} />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-black/10 px-4 py-3">
        {QUICK_ACTIONS.map((action) => (
          <Chip
            key={action.label}
            className="cursor-pointer border-2 border-black bg-white px-2 text-xs font-semibold text-black"
            onClick={() => sendMessage(action.prompt)}
          >
            {action.label}
          </Chip>
        ))}
      </div>

      <ScrollShadow className="min-h-[18rem] flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <DockMessageBubble key={message.id} message={message} />
          ))}
          {loading && (
            <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black/65">
              <Loader2 size={14} className="animate-spin" />
              思考并调用工具中...
            </div>
          )}
        </div>
      </ScrollShadow>

      {hasPendingActions && (
        <div className="border-t-2 border-black bg-[#F7E4E1] px-4 py-3">
          <p className="text-xs font-bold text-black">需要确认的动作</p>
          <div className="mt-2 space-y-2">
            {pendingActions.map((action) => (
              <div key={action.id} className="border border-black bg-white px-3 py-2 text-xs font-medium text-black">
                {action.summary}
              </div>
            ))}
          </div>
          <Button
            onPress={confirmPendingActions}
            isDisabled={loading}
            startContent={loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            className="bauhaus-button bauhaus-button-red mt-3 !w-full !justify-center !py-2 !text-xs"
          >
            确认执行
          </Button>
        </div>
      )}

      {error && (
        <div className="border-t border-black bg-[#D02020] px-4 py-2 text-xs font-semibold text-white">
          {error}
        </div>
      )}

      <footer className="border-t-2 border-black bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onValueChange={setInput}
            minRows={1}
            maxRows={3}
            placeholder="告诉我你想推进哪一步..."
            variant="bordered"
            className="flex-1"
            classNames={bauhausFieldClassNames}
            isDisabled={loading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            isIconOnly
            aria-label="发送"
            onPress={() => sendMessage()}
            isDisabled={!input.trim() || loading}
            className="bauhaus-button bauhaus-button-red !min-h-10 !min-w-10 !px-0 !py-0"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </footer>
    </section>
  );
}

function DockMessageBubble({ message }: { message: DockMessage }) {
  const isUser = message.role === "user";
  const response = message.response;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap border-2 border-black px-3 py-2 text-sm font-medium leading-6 shadow-[2px_2px_0_0_rgba(18,18,18,0.18)] ${
            isUser ? "bg-[#F7E4E1] text-black" : "bg-white text-black"
          }`}
        >
          {message.content}
        </div>
        {response && (
          <div className="mt-3 space-y-3 text-left">
            {response.transferable_skills_summary && (
              <Card className="rounded-none border-2 border-black shadow-none">
                <CardBody className="p-3 text-xs font-medium leading-5 text-black/75">
                  {response.transferable_skills_summary}
                </CardBody>
              </Card>
            )}
            {response.career_paths && response.career_paths.length > 0 && (
              <CareerPathList paths={response.career_paths} />
            )}
            {response.job_cards && response.job_cards.length > 0 && (
              <JobCardList jobs={response.job_cards} />
            )}
            {response.tool_calls && response.tool_calls.length > 0 && (
              <ToolCallList calls={response.tool_calls} />
            )}
            {response.next_steps && response.next_steps.length > 0 && (
              <ul className="space-y-1 border border-black/20 bg-[var(--surface-muted)] p-3 text-xs font-medium text-black/70">
                {response.next_steps.map((step) => (
                  <li key={step}>- {step}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CareerPathList({ paths }: { paths: HarnessAgentCareerPath[] }) {
  return (
    <div className="space-y-2">
      {paths.map((path) => (
        <Card key={path.title} className="rounded-none border-2 border-black bg-white shadow-none">
          <CardBody className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="mt-1 shrink-0 text-[#D02020]" />
              <div className="min-w-0">
                <p className="text-sm font-black text-black">{path.title}</p>
                <p className="mt-1 text-[11px] font-semibold text-black/55">{path.industry}</p>
                <p className="mt-2 text-xs font-medium leading-5 text-black/70">{path.fit_reason}</p>
                <p className="mt-2 text-xs font-semibold text-black">{path.salary_range}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {path.search_keywords.map((keyword) => (
                    <Chip key={keyword} size="sm" className="border border-black bg-[#F0C020] text-[10px] text-black">
                      {keyword}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function JobCardList({ jobs }: { jobs: HarnessAgentJobCard[] }) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card key={job.id} className="rounded-none border-2 border-black bg-white shadow-none">
          <CardBody className="p-3">
            <div className="flex items-start gap-2">
              <Briefcase size={15} className="mt-1 shrink-0 text-[#2060D0]" />
              <div className="min-w-0">
                <p className="text-sm font-black text-black">{job.company}</p>
                <p className="mt-1 text-xs font-semibold text-black/70">{job.title}</p>
                <p className="mt-1 text-[11px] font-medium text-black/55">
                  {[job.location, job.salary_text, job.source].filter(Boolean).join(" / ")}
                </p>
                {job.apply_url && (
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-[#D02020] underline"
                  >
                    打开投递链接
                  </a>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function ToolCallList({ calls }: { calls: HarnessAgentResponse["tool_calls"] }) {
  return (
    <div className="space-y-2">
      {calls.map((call, index) => (
        <details key={`${call.tool}-${index}`} className="border border-black/25 bg-white p-2 text-xs text-black/65">
          <summary className="flex cursor-pointer items-center gap-2 font-bold text-black">
            <Wrench size={13} />
            {call.tool}
          </summary>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap bg-[#F0F0F0] p-2">
            {previewJson(call.result)}
          </pre>
        </details>
      ))}
    </div>
  );
}
