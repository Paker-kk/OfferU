// =============================================
// OfferU Agent Console — AI 全流程助手
// =============================================
// Chat 风格界面，SSE 流式交互
// LLM 自动编排 MCP Tools 完成全流程操作
// =============================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button, Chip, Card, CardBody, Textarea, ScrollShadow } from "@nextui-org/react";
import { Send, Bot, User, Wrench, Loader2, Sparkles, Trash2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---- Types ----

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

// ---- Quick Actions ----

const QUICK_ACTIONS = [
  { label: "📋 查看我的资料", prompt: "帮我看看我的个人资料" },
  { label: "📊 岗位统计", prompt: "帮我统计一下目前的岗位情况" },
  { label: "📄 简历列表", prompt: "列出我的所有简历" },
  { label: "🔍 浏览岗位", prompt: "帮我看看最新的岗位列表" },
  { label: "✨ 生成简历", prompt: "帮我挑几个合适的岗位生成定制简历" },
];

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是 OfferU AI 助手 🤖\n\n我可以帮你完成求职全流程：查看岗位、筛选分拣、AI 生成定制简历、管理投递记录等。\n\n试试点击下方快捷操作，或直接告诉我你想做什么！",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 自动滚到底部
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

      // 构建完整消息历史（不含 tool 类型和 welcome）
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const thinkingId = `t-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: thinkingId, role: "assistant", content: "", thinking: true },
      ]);

      try {
        abortRef.current = new AbortController();
        const res = await fetch(`${API_BASE}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
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
            if (line.startsWith("event:")) {
              const eventType = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (!dataStr) continue;
              try {
                const data = JSON.parse(dataStr);

                if (data.content) {
                  finalContent = data.content;
                }
                if (data.tool) {
                  toolCalls.push({
                    tool: data.tool,
                    args: data.args || {},
                    result: data.result,
                  });
                  // 更新 thinking 消息显示工具调用进度
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === thinkingId
                        ? { ...m, content: `正在调用 ${data.tool}...`, toolCalls: [...toolCalls] }
                        : m
                    )
                  );
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }

        // 替换 thinking 消息为最终结果
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  content: finalContent || "操作完成",
                  thinking: false,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                }
              : m
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, content: "请求失败，请重试。", thinking: false }
              : m
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [messages, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "对话已清空。有什么可以帮你的？",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Agent Console</h1>
            <p className="text-sm text-default-400">
              全流程求职助手 · 13 个 Tools 就绪
            </p>
          </div>
        </div>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={clearChat}
          title="清空对话"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollShadow ref={scrollRef} className="flex-1 overflow-y-auto px-2 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </ScrollShadow>

      {/* Quick Actions (only when few messages) */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 px-2 py-3">
          {QUICK_ACTIONS.map((qa) => (
            <Chip
              key={qa.label}
              variant="bordered"
              className="cursor-pointer hover:bg-default-100 transition-colors"
              onClick={() => sendMessage(qa.prompt)}
            >
              {qa.label}
            </Chip>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-white/10">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onValueChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求...（Enter 发送，Shift+Enter 换行）"
            minRows={1}
            maxRows={4}
            variant="bordered"
            className="flex-1"
            isDisabled={loading}
          />
          <Button
            isIconOnly
            color="primary"
            onPress={() => sendMessage(input)}
            isDisabled={!input.trim() || loading}
            className="mb-0.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Message Bubble ----

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-blue-600" : "bg-gradient-to-br from-purple-500 to-pink-500"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
        {/* Thinking indicator */}
        {msg.thinking && (
          <div className="flex items-center gap-2 text-default-400 text-sm mb-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{msg.content || "思考中..."}</span>
          </div>
        )}

        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-2 mb-2">
            {msg.toolCalls.map((tc, i) => (
              <Card key={i} className="bg-default-50/50">
                <CardBody className="p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <Wrench className="w-3.5 h-3.5 text-warning" />
                    <span className="text-warning">{tc.tool}</span>
                    {Object.keys(tc.args).length > 0 && (
                      <span className="text-default-400 text-xs">
                        ({Object.entries(tc.args)
                          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                          .join(", ")})
                      </span>
                    )}
                  </div>
                  <ToolResultPreview result={tc.result} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Main content */}
        {!msg.thinking && msg.content && (
          <div
            className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? "bg-primary text-white rounded-br-md"
                : "bg-default-100 text-foreground rounded-bl-md"
            }`}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tool Result Preview ----

function ToolResultPreview({ result }: { result: unknown }) {
  if (!result || typeof result !== "object") return null;

  const data = result as Record<string, unknown>;

  // 如果有 error
  if (data.error) {
    return <p className="text-xs text-danger">{String(data.error)}</p>;
  }

  // 简要预览
  const text = JSON.stringify(result, null, 2);
  const preview = text.length > 300 ? text.slice(0, 300) + "..." : text;

  return (
    <pre className="text-xs text-default-500 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
      {preview}
    </pre>
  );
}
