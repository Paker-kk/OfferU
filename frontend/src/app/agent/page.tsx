"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  ScrollShadow,
  Textarea,
} from "@nextui-org/react";
import { Bot, Loader2, Send, Sparkles, Trash2, User, Wrench } from "lucide-react";
import { bauhausFieldClassNames } from "@/lib/bauhaus";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCallInfo[];
  thinking?: boolean;
}

interface ToolCallInfo {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

const QUICK_ACTIONS = [
  { label: "查看资料", prompt: "帮我看看我的个人资料" },
  { label: "岗位统计", prompt: "帮我统计一下目前的岗位情况" },
  { label: "简历列表", prompt: "列出我的所有简历" },
  { label: "浏览岗位", prompt: "帮我看看最新的岗位列表" },
  { label: "生成简历", prompt: "帮我挑几个合适的岗位生成定制简历" },
];

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好，我是 OfferU AI 助手。\n\n我可以帮你查看岗位、筛选分拣、生成定制简历、管理投递记录和梳理求职流程。点击下方快捷动作，或直接告诉我你想完成什么。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      const historyForApi = [...messages, userMsg]
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .filter((msg) => msg.id !== "welcome")
        .map((msg) => ({ role: msg.role, content: msg.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const thinkingId = `t-${Date.now()}`;
      setMessages((prev) => [...prev, { id: thinkingId, role: "assistant", content: "", thinking: true }]);

      try {
        abortRef.current = new AbortController();
        const response = await fetch(`${API_BASE}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const toolCalls: ToolCallInfo[] = [];
        let finalContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.content) finalContent = data.content;
              if (data.tool) {
                toolCalls.push({
                  tool: data.tool,
                  args: data.args || {},
                  result: data.result,
                });
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === thinkingId
                      ? { ...msg, content: `正在调用 ${data.tool}...`, toolCalls: [...toolCalls] }
                      : msg
                  )
                );
              }
            } catch {}
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === thinkingId
              ? {
                  ...msg,
                  content: finalContent || "操作完成",
                  thinking: false,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                }
              : msg
          )
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === thinkingId ? { ...msg, content: "请求失败，请重试。", thinking: false } : msg
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, messages]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "对话已清空。告诉我你接下来想推进哪一段求职流程。",
      },
    ]);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-6xl flex-col gap-4">
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bauhaus-panel-sm flex h-12 w-12 items-center justify-center bg-[#F0C020] text-black">
                  <Bot size={22} />
                </div>
                <div>
                  <p className="bauhaus-label text-black/55">AI Workspace</p>
                  <h1 className="mt-1 text-3xl font-black tracking-[-0.06em] text-black md:text-4xl">
                    AI 求职助手
                  </h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm font-medium leading-relaxed text-black/72 md:text-base">
                直接说目标，助手会帮你查岗位、看简历、梳理投递并调用工具，把下一步动作尽快推进。
              </p>
            </div>

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

          <div className="flex flex-wrap gap-2">
            <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[var(--surface-muted)] px-3 py-2 text-black">
              岗位查询
            </Chip>
            <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[#F0C020] px-3 py-2 text-black">
              简历联动
            </Chip>
            <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-[#F7E4E1] px-3 py-2 text-black">
              连续对话
            </Chip>
            <Chip variant="flat" className="bauhaus-chip border-2 border-black bg-white px-3 py-2 text-black">
              工具执行
            </Chip>
          </div>
        </div>
      </section>

      <ScrollShadow
        ref={scrollRef}
        className="bauhaus-panel flex-1 min-h-[30rem] overflow-y-auto bg-white p-4 md:p-6"
      >
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      </ScrollShadow>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action, index) => (
            <Chip
              key={action.label}
              variant="flat"
              className={`cursor-pointer border-2 border-black px-3 py-2 text-sm font-semibold ${
                index % 4 === 0
                  ? "bg-[var(--surface-muted)] text-black"
                  : index % 4 === 1
                    ? "bg-[#F0C020] text-black"
                    : index % 4 === 2
                      ? "bg-white text-black"
                      : "bg-[#F7E4E1] text-black"
              }`}
              onClick={() => sendMessage(action.prompt)}
            >
              {action.label}
            </Chip>
          ))}
        </div>
      )}

      <div className="bauhaus-panel-sm bg-white p-4 md:p-5">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onValueChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求...（Enter 发送，Shift+Enter 换行）"
            minRows={1}
            maxRows={4}
            variant="bordered"
            className="flex-1"
            classNames={bauhausFieldClassNames}
            isDisabled={loading}
          />
          <Button
            isIconOnly
            onPress={() => sendMessage(input)}
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

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";

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
        {msg.thinking && (
          <div className="mb-2 inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-3 text-[15px] font-medium text-black/65 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]">
            <Loader2 size={13} className="animate-spin" />
            <span>{msg.content || "思考中..."}</span>
          </div>
        )}

        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.toolCalls.map((toolCall, index) => (
              <Card key={index} className="bauhaus-panel-sm rounded-none bg-white shadow-none">
                <CardBody className="p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-[var(--surface-muted)] text-black">
                      <Wrench size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold tracking-[0.02em] text-black">{toolCall.tool}</p>
                      {Object.keys(toolCall.args).length > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-black/45">
                          {Object.entries(toolCall.args)
                            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <ToolResultPreview result={toolCall.result} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {!msg.thinking && msg.content && (
          <div
            className={`inline-block whitespace-pre-wrap border-2 border-black px-4 py-3.5 text-[15px] font-medium leading-7 shadow-[3px_3px_0_0_rgba(18,18,18,0.28)] md:px-5 md:py-4 md:text-base ${
              isUser ? "bg-[#F7E4E1] text-black" : "bg-white text-black"
            }`}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolResultPreview({ result }: { result: unknown }) {
  if (!result || typeof result !== "object") return null;

  const data = result as Record<string, unknown>;
  if (data.error) {
    return <p className="text-xs font-medium text-[#D02020]">{String(data.error)}</p>;
  }

  const text = JSON.stringify(result, null, 2);
  const preview = text.length > 320 ? `${text.slice(0, 320)}...` : text;

  return (
    <pre className="max-h-32 overflow-x-auto overflow-y-auto whitespace-pre-wrap bg-[#F0F0F0] p-3 text-xs font-medium text-black/65">
      {preview}
    </pre>
  );
}
