"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardBody, Textarea } from "@nextui-org/react";
import { ArrowLeft, ArrowRight, Bot, SkipForward } from "lucide-react";
import { BulletConfirmCard, type BulletCandidate } from "./BulletConfirmCard";
import { profileApi } from "@/lib/api";

export type ChatTopic = "education" | "internship" | "project" | "activity" | "skill";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  bullet?: BulletCandidate;
}

interface ChatPanelProps {
  topic: ChatTopic;
  topicLabel: string;
  onNextTopic: () => void;
  onPrevTopic: () => void;
  onBulletConfirmed: () => void;
  isLastTopic: boolean;
  isFirstTopic: boolean;
}

const TOPIC_GREETINGS: Record<ChatTopic, string> = {
  education: "我们先从教育经历开始，你可以先说学校、专业和亮点。",
  internship: "接下来聊实习经历：公司、岗位、你做了什么、结果如何。",
  project: "现在说项目经历：背景、角色、动作、结果。",
  activity: "再聊活动经历：社团/志愿者/比赛，重点是你的贡献。",
  skill: "最后补充技能与证书：工具、语言能力、证书和熟练度。",
};

function toBulletCandidate(payload: any): BulletCandidate | null {
  if (!payload || typeof payload !== "object") return null;
  const content = payload.content_json && typeof payload.content_json === "object" ? payload.content_json : {};
  const text =
    String(content.bullet || payload.description || payload.content || "").trim() ||
    String(payload.title || "待确认条目").trim();

  if (typeof payload.session_id !== "number" || typeof payload.index !== "number") {
    return null;
  }

  return {
    session_id: payload.session_id,
    bullet_index: payload.index,
    title: String(payload.title || "待确认条目"),
    description: text,
    confidence: Number(payload.confidence ?? 0.7),
  };
}

export function ChatPanel({
  topic,
  topicLabel,
  onNextTopic,
  onPrevTopic,
  onBulletConfirmed,
  isLastTopic,
  isFirstTopic,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const idRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: `msg-${++idRef.current}`,
        role: "ai",
        content: TOPIC_GREETINGS[topic],
      },
    ]);
    setSessionId(undefined);
    setText("");
    abortRef.current?.abort();
  }, [topic]);

  const pushMessage = useCallback((role: "ai" | "user", content: string) => {
    setMessages((prev) => [...prev, { id: `msg-${++idRef.current}`, role, content }]);
  }, []);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || isTyping) return;

    setText("");
    pushMessage("user", content);
    setIsTyping(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await profileApi.chat({
        topic,
        message: content,
        session_id: sessionId,
      });

      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const lines = chunk.trim().split(/\r?\n/);
          let eventType = "";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }

          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine);

            if (eventType === "ai_message") {
              const aiText = String(parsed.content || "").trim();
              if (aiText) pushMessage("ai", aiText);
            }

            if (eventType === "bullet_candidate") {
              const bullet = toBulletCandidate(parsed);
              if (bullet) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg-${++idRef.current}`,
                    role: "ai",
                    content: "",
                    bullet,
                  },
                ]);
              }
            }

            if (typeof parsed.session_id === "number") {
              setSessionId(parsed.session_id);
            }

            if (eventType === "error") {
              pushMessage("ai", `⚠️ ${String(parsed.message || parsed.detail || "请求失败")}`);
            }
          } catch {
            // 忽略单个坏事件
          }
        }
      }

      reader.releaseLock();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        pushMessage("ai", "⚠️ 网络错误，请稍后重试");
      }
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, pushMessage, sessionId, text, topic]);

  return (
    <Card className="h-full bg-white/5 border border-white/10 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Bot size={18} className="text-blue-400" />
        <span className="text-sm font-medium text-white">AI 对话引导 · {topicLabel}</span>
      </div>

      <CardBody className="flex-1 min-h-0 overflow-y-auto gap-3">
        {messages.map((msg) => {
          if (msg.bullet) {
            return (
              <BulletConfirmCard
                key={msg.id}
                bullet={msg.bullet}
                onConfirmed={onBulletConfirmed}
                onSkipped={() => {}}
              />
            );
          }

          const mine = msg.role === "user";
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-blue-500 text-white" : "bg-white/10 text-white/85"}`}>
                {msg.content}
              </div>
            </div>
          );
        })}
      </CardBody>

      <div className="px-4 pb-3 pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onValueChange={setText}
            minRows={1}
            maxRows={4}
            placeholder="输入你的经历..."
            variant="bordered"
            classNames={{
              input: "text-sm text-white/90",
              inputWrapper: "bg-white/5 border-white/15",
            }}
          />
          <Button color="primary" isLoading={isTyping} onPress={handleSend}>
            发送
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="light"
            startContent={<ArrowLeft size={14} />}
            isDisabled={isFirstTopic}
            onPress={onPrevTopic}
          >
            上一步
          </Button>

          <Button
            size="sm"
            variant="flat"
            startContent={<SkipForward size={14} />}
            className="text-white/50"
            onPress={onNextTopic}
          >
            跳过主题
          </Button>

          <Button
            size="sm"
            color="primary"
            endContent={<ArrowRight size={14} />}
            isDisabled={isLastTopic}
            onPress={onNextTopic}
          >
            {isLastTopic ? "完成" : "下一主题"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
