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
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import {
  harnessAgentApi,
  type HarnessAgentCareerPath,
  type HarnessAgentJobCard,
  type HarnessAgentMessage,
  type HarnessAgentProposedAction,
  type HarnessAgentResponse,
  type HarnessAgentToolCall,
} from "@/lib/api";
import { bauhausFieldClassNames } from "@/lib/bauhaus";

interface ConsoleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: HarnessAgentResponse;
}

const QUICK_ACTIONS = [
  { label: "职业探索", prompt: "参考我的档案，给我 5 个意想不到但适合我的职业方向" },
  { label: "岗位匹配", prompt: "帮我看看现在岗位库里适合投哪些岗位" },
  { label: "简历准备", prompt: "帮我为最适合的岗位准备定制简历" },
  { label: "投递跟进", prompt: "帮我梳理投递管理和下一步动作" },
  { label: "面试日程", prompt: "帮我检查邮件通知和面试日程" },
];

function previewJson(value: unknown) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 420 ? `${text.slice(0, 420)}...` : text;
  } catch {
    return String(value);
  }
}

function toApiMessages(messages: ConsoleMessage[]): HarnessAgentMessage[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .map((message) => ({ role: message.role, content: message.content }));
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "我是 OfferU Harness Agent。你可以直接给我一个目标，我会读取档案、岗位、简历、投递和日程上下文，然后把下一步拆成可确认的动作。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingActions, setPendingActions] = useState<HarnessAgentProposedAction[]>([]);

  const latestMode = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.response?.mode);
    return latest?.response?.mode || "ready";
  }, [messages]);

  const sendMessage = async (text?: string, confirmedActionIds?: string[]) => {
    const content = (text ?? input).trim();
    const isConfirmation = Boolean(confirmedActionIds?.length);
    if ((!content && !isConfirmation) || loading) return;

    const userMessage: ConsoleMessage | null = isConfirmation
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
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.assistant_message,
          response,
        },
      ]);
      setPendingActions(response.proposed_actions || []);
    } catch (err: any) {
      setError(err.message || "Harness Agent 请求失败");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "对话已清空。告诉我你想让 OfferU 先推进哪一步。",
      },
    ]);
    setPendingActions([]);
    setError("");
  };

  const confirmActions = () => {
    sendMessage("", pendingActions.map((action) => action.id));
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col gap-4 pb-6">
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bauhaus-panel-sm flex h-12 w-12 items-center justify-center bg-[#F0C020] text-black">
                  <Bot size={22} />
                </div>
                <div>
                  <p className="bauhaus-label text-black/55">Harness Workspace</p>
                  <h1 className="mt-1 text-3xl font-black text-black md:text-4xl">
                    OfferU 全局助手
                  </h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                让助手读取你的求职上下文，先分析，再调用工具。批量筛选、导入投递表、同步日程这类动作会先展示计划。
              </p>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <Chip className="w-fit border-2 border-black bg-[var(--surface-muted)] text-xs font-semibold text-black">
                {latestMode}
              </Chip>
              <Button
                variant="light"
                onPress={clearChat}
                title="清空对话"
                startContent={<Trash2 size={16} />}
                className="bauhaus-button bauhaus-button-outline !w-full !justify-center !px-4 !py-3 !text-[11px] md:!w-auto"
              >
                重置对话
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action, index) => (
              <Chip
                key={action.label}
                className={`cursor-pointer border-2 border-black px-3 py-2 text-sm font-semibold ${
                  index % 3 === 0
                    ? "bg-[#F0C020] text-black"
                    : index % 3 === 1
                      ? "bg-white text-black"
                      : "bg-[#F7E4E1] text-black"
                }`}
                onClick={() => sendMessage(action.prompt)}
              >
                {action.label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <ScrollShadow className="bauhaus-panel min-h-[22rem] flex-1 overflow-y-auto bg-white p-4 md:min-h-[26rem] md:p-6">
        <div className="space-y-5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {loading && (
            <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-3 text-[15px] font-medium text-black/65 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]">
              <Loader2 size={14} className="animate-spin" />
              思考并调用工具中...
            </div>
          )}
        </div>
      </ScrollShadow>

      {pendingActions.length > 0 && (
        <section className="bauhaus-panel-sm bg-[#F7E4E1] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-black">需要确认的动作</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingActions.map((action) => (
                  <Chip key={action.id} className="border-2 border-black bg-white text-xs font-semibold text-black">
                    {action.summary}
                  </Chip>
                ))}
              </div>
            </div>
            <Button
              onPress={confirmActions}
              isDisabled={loading}
              startContent={loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              className="bauhaus-button bauhaus-button-red !justify-center !px-5 !py-3 !text-xs"
            >
              确认执行
            </Button>
          </div>
        </section>
      )}

      {error && (
        <div className="bauhaus-panel-sm bg-[#D02020] px-4 py-3 text-sm font-medium text-white">
          {error}
        </div>
      )}

      <div className="bauhaus-panel-sm bg-white p-4 md:p-5">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onValueChange={setInput}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="输入你的目标..."
            minRows={1}
            maxRows={4}
            variant="bordered"
            className="flex-1"
            classNames={bauhausFieldClassNames}
            isDisabled={loading}
          />
          <Button
            isIconOnly
            onPress={() => sendMessage()}
            isDisabled={!input.trim() || loading}
            aria-label="发送消息"
            className="bauhaus-button bauhaus-button-red !mb-[2px] !min-h-11 !min-w-11 !px-0 !py-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConsoleMessage }) {
  const isUser = message.role === "user";
  const response = message.response;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center border-2 border-black ${
          isUser ? "bg-[#D02020] text-white" : "bg-[#F0C020] text-black"
        }`}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      <div className={`max-w-[92%] md:max-w-[84%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap border-2 border-black px-4 py-3.5 text-[15px] font-medium leading-7 shadow-[3px_3px_0_0_rgba(18,18,18,0.28)] md:px-5 md:py-4 md:text-base ${
            isUser ? "bg-[#F7E4E1] text-black" : "bg-white text-black"
          }`}
        >
          {message.content}
        </div>

        {response && (
          <div className="mt-4 space-y-4 text-left">
            {response.transferable_skills_summary && (
              <Card className="bauhaus-panel-sm rounded-none bg-white shadow-none">
                <CardBody className="p-4 text-sm font-medium leading-6 text-black/75">
                  {response.transferable_skills_summary}
                </CardBody>
              </Card>
            )}
            {response.career_paths && response.career_paths.length > 0 && (
              <CareerPathGrid paths={response.career_paths} />
            )}
            {response.job_cards && response.job_cards.length > 0 && (
              <JobCardGrid jobs={response.job_cards} />
            )}
            {response.tool_calls && response.tool_calls.length > 0 && (
              <ToolCallPanel calls={response.tool_calls} />
            )}
            {response.next_steps && response.next_steps.length > 0 && (
              <Card className="bauhaus-panel-sm rounded-none bg-[var(--surface-muted)] shadow-none">
                <CardBody className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-black/45">Next steps</p>
                  <ul className="mt-2 space-y-1 text-sm font-medium leading-6 text-black/72">
                    {response.next_steps.map((step) => (
                      <li key={step}>- {step}</li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CareerPathGrid({ paths }: { paths: HarnessAgentCareerPath[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {paths.map((path) => (
        <Card key={path.title} className="bauhaus-panel-sm rounded-none bg-white shadow-none">
          <CardBody className="p-4">
            <p className="text-base font-black text-black">{path.title}</p>
            <p className="mt-1 text-xs font-semibold text-black/50">{path.industry}</p>
            <p className="mt-3 text-sm font-medium leading-6 text-black/72">{path.fit_reason}</p>
            <div className="mt-3 space-y-2 text-xs font-medium leading-5 text-black/65">
              <p>{path.entry_route}</p>
              <p className="font-bold text-black">{path.salary_range}</p>
              <p>{path.application_strategy}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {path.search_keywords.map((keyword) => (
                <Chip key={keyword} size="sm" className="border border-black bg-[#F0C020] text-[10px] text-black">
                  {keyword}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function JobCardGrid({ jobs }: { jobs: HarnessAgentJobCard[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {jobs.map((job) => (
        <Card key={job.id} className="bauhaus-panel-sm rounded-none bg-white shadow-none">
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black bg-[var(--surface-muted)] text-black">
                <Briefcase size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-black">{job.company}</p>
                <p className="mt-1 text-sm font-semibold text-black/72">{job.title}</p>
                <p className="mt-1 text-xs font-medium text-black/50">
                  {[job.location, job.salary_text, job.source].filter(Boolean).join(" / ")}
                </p>
                {job.summary && <p className="mt-2 text-xs font-medium leading-5 text-black/60">{job.summary}</p>}
                {job.apply_url && (
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs font-bold text-[#D02020] underline"
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

function ToolCallPanel({ calls }: { calls: HarnessAgentToolCall[] }) {
  return (
    <div className="space-y-2">
      {calls.map((call, index) => (
        <Card key={`${call.tool}-${index}`} className="bauhaus-panel-sm rounded-none bg-white shadow-none">
          <CardBody className="p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Wrench size={14} />
              {call.tool}
            </div>
            <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap bg-[#F0F0F0] p-3 text-xs font-medium text-black/65">
              {previewJson(call.result)}
            </pre>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
