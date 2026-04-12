// =============================================
// ChatPanel — 右侧 AI 对话引导面板
// =============================================
// 使用 @chatscope/chat-ui-kit-react 构建聊天 UI
// SSE 流式渲染 AI 回复
// Bullet 候选卡片嵌入消息流
// 底部操作栏: 上一步 / 跳过主题 / 下一主题
// =============================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Button, Card } from "@nextui-org/react";
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Send,
  Bot,
  User,
} from "lucide-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import {
  BulletConfirmCard,
  type BulletCandidate,
} from "./BulletConfirmCard";
import { profileApi } from "@/lib/api";
import type { Topic } from "../page";

// 消息类型
interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  bullet?: BulletCandidate;
}

interface ChatPanelProps {
  topic: Topic;
  topicLabel: string;
  onNextTopic: () => void;
  onPrevTopic: () => void;
  onBulletConfirmed: () => void;
  isLastTopic: boolean;
  isFirstTopic: boolean;
}

// 主题初始引导语
const TOPIC_GREETINGS: Record<Topic, string> = {
  education:
    "你好！让我们先从教育经历开始。你的学校、专业、学位是什么？有什么特别的课程或成绩吗？",
  internship:
    "接下来聊聊实习经历。你做过哪些实习？在哪家公司？主要负责什么？",
  project:
    "现在说说你的项目经历吧。做过什么项目？你在其中承担什么角色？取得了什么成果？",
  activity:
    "有参加过什么社团活动、志愿者或课外活动吗？你在其中发挥了什么作用？",
  skill:
    "最后跟我聊聊你的技能和证书吧。会使用哪些工具或软件？有什么认证或奖项？",
};

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
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const msgIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // 主题切换时，重置对话并发送引导语
  useEffect(() => {
    const greeting: ChatMessage = {
      id: `msg-${++msgIdRef.current}`,
      role: "ai",
      content: TOPIC_GREETINGS[topic],
    };
    setMessages([greeting]);
    setSessionId(undefined);
    // 取消进行中的请求
    abortRef.current?.abort();
  }, [topic]);

  // SSE 发送消息
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      // 用户消息
      const userMsg: ChatMessage = {
        id: `msg-${++msgIdRef.current}`,
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      // 取消旧请求
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await profileApi.chat({
          topic,
          message: text.trim(),
          session_id: sessionId,
        });

        if (!res.ok) {
          throw new Error(`API ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取流");

        const decoder = new TextDecoder();
        let buffer = "";
        let aiContent = "";
        const aiMsgId = `msg-${++msgIdRef.current}`;

        // 添加空的 AI 回复占位
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, role: "ai", content: "" },
        ]);

        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.trim().split(/\r?\n/);
            let eventType = "";
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(5).trim();
            }

            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              switch (eventType) {
                case "ai_message":
                  // 流式追加 AI 文本
                  aiContent += parsed.content || "";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId
                        ? { ...m, content: aiContent }
                        : m
                    )
                  );
                  break;

                case "bullet_candidate": {
                  // 生成 Bullet 确认卡片
                  const bulletMsg: ChatMessage = {
                    id: `msg-${++msgIdRef.current}`,
                    role: "ai",
                    content: "",
                    bullet: {
                      section_id: parsed.section_id,
                      title: parsed.title || "",
                      organization: parsed.organization,
                      date_range: parsed.date_range,
                      description: parsed.description || "",
                      confidence: parsed.confidence ?? 0.8,
                    },
                  };
                  setMessages((prev) => [...prev, bulletMsg]);
                  break;
                }

                case "session_id":
                  setSessionId(parsed.session_id);
                  break;

                case "topic_complete":
                  // 主题完成提示
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${++msgIdRef.current}`,
                      role: "ai",
                      content:
                        parsed.message ||
                        `${topicLabel}主题已完成！可以继续下一个主题。`,
                    },
                  ]);
                  break;

                case "error":
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${++msgIdRef.current}`,
                      role: "ai",
                      content: `⚠️ ${parsed.detail || "出现了错误，请重试"}`,
                    },
                  ]);
                  break;
              }
            } catch {
              // 跳过无法解析的事件
            }
          }
        }

        reader.releaseLock();
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${++msgIdRef.current}`,
              role: "ai",
              content: "⚠️ 网络错误，请检查后端服务后重试",
            },
          ]);
        }
      } finally {
        setIsTyping(false);
      }
    },
    [topic, topicLabel, sessionId, isTyping]
  );

  return (
    <Card className="h-full bg-white/5 border border-white/10 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Bot size={18} className="text-blue-400" />
        <span className="text-sm font-medium text-white">
          AI 对话引导 · {topicLabel}
        </span>
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 min-h-0 chat-panel-wrapper">
        <MainContainer>
          <ChatContainer>
            <MessageList
              typingIndicator={
                isTyping ? (
                  <TypingIndicator content="AI 正在思考..." />
                ) : null
              }
            >
              {messages.map((msg) => {
                // Bullet 确认卡片
                if (msg.bullet) {
                  return (
                    <Message
                      key={msg.id}
                      model={{
                        message: "",
                        sender: "AI",
                        direction: "incoming",
                        position: "single",
                      }}
                    >
                      <Message.CustomContent>
                        <BulletConfirmCard
                          bullet={msg.bullet}
                          onConfirmed={onBulletConfirmed}
                          onSkipped={() => {}}
                        />
                      </Message.CustomContent>
                    </Message>
                  );
                }

                return (
                  <Message
                    key={msg.id}
                    model={{
                      message: msg.content,
                      sender: msg.role === "ai" ? "AI" : "用户",
                      direction:
                        msg.role === "ai" ? "incoming" : "outgoing",
                      position: "single",
                    }}
                  />
                );
              })}
            </MessageList>

            <MessageInput
              placeholder="输入你的经历..."
              attachButton={false}
              onSend={(_, text) => handleSend(text)}
              disabled={isTyping}
            />
          </ChatContainer>
        </MainContainer>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
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
    </Card>
  );
}
