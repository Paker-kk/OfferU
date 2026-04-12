// =============================================
// Profile 页面 — 个人档案构建中心
// =============================================
// 左右双栏布局：
//   左侧 (40%): ProfilePreview — 已有档案条目预览
//   右侧 (60%): ChatPanel — AI对话引导面板 + Bullet确认
// 顶部: TopicStepper — 主题进度条
// 冷启动: 如果 Profile 为空 → 弹出 OnboardingWizard
// =============================================

"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@nextui-org/react";
import { useProfile, type ProfileSection } from "@/lib/hooks";
import { TopicStepper } from "./components/TopicStepper";
import { ProfilePreview } from "./components/ProfilePreview";
import { ChatPanel } from "./components/ChatPanel";
import { ProfileOnboarding } from "./components/ProfileOnboarding";

// 对话主题轮转顺序
const TOPICS = ["education", "internship", "project", "activity", "skill"] as const;
export type Topic = (typeof TOPICS)[number];

const TOPIC_LABELS: Record<Topic, string> = {
  education: "教育",
  internship: "实习",
  project: "项目",
  activity: "社团",
  skill: "技能",
};

export default function ProfilePage() {
  const { data: profile, error, isLoading, mutate } = useProfile();
  const [currentTopic, setCurrentTopic] = useState<Topic>("education");

  // 判断每个主题是否已有条目
  const topicStatus = useCallback(
    (topic: Topic): "done" | "active" | "todo" => {
      if (topic === currentTopic) return "active";
      const sections = profile?.sections ?? [];
      const has = sections.some(
        (s: ProfileSection) => s.section_type === topic && s.is_confirmed
      );
      return has ? "done" : "todo";
    },
    [profile, currentTopic]
  );

  // 切换主题
  const goNextTopic = useCallback(() => {
    const idx = TOPICS.indexOf(currentTopic);
    if (idx < TOPICS.length - 1) setCurrentTopic(TOPICS[idx + 1]);
  }, [currentTopic]);

  const goPrevTopic = useCallback(() => {
    const idx = TOPICS.indexOf(currentTopic);
    if (idx > 0) setCurrentTopic(TOPICS[idx - 1]);
  }, [currentTopic]);

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-white/50">
        加载失败，请检查后端服务
      </div>
    );
  }

  // 冷启动：Profile 不存在或没有任何 section
  const isEmpty =
    !profile ||
    (!profile.name && (!profile.sections || profile.sections.length === 0));

  if (isEmpty) {
    return <ProfileOnboarding onComplete={() => mutate()} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-4rem)] gap-4"
    >
      {/* 顶部进度条 */}
      <TopicStepper
        topics={TOPICS as unknown as Topic[]}
        labels={TOPIC_LABELS}
        statusFn={topicStatus}
        current={currentTopic}
        onSelect={setCurrentTopic}
      />

      {/* 主体双栏 */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* 左侧预览 */}
        <div className="w-[40%] min-w-[320px] overflow-auto">
          <ProfilePreview
            profile={profile}
            currentTopic={currentTopic}
            onRefresh={() => mutate()}
          />
        </div>

        {/* 右侧对话 */}
        <div className="flex-1 min-w-[400px]">
          <ChatPanel
            topic={currentTopic}
            topicLabel={TOPIC_LABELS[currentTopic]}
            onNextTopic={goNextTopic}
            onPrevTopic={goPrevTopic}
            onBulletConfirmed={() => mutate()}
            isLastTopic={currentTopic === TOPICS[TOPICS.length - 1]}
            isFirstTopic={currentTopic === TOPICS[0]}
          />
        </div>
      </div>
    </motion.div>
  );
}
