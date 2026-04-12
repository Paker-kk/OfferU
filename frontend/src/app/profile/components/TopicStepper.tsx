// =============================================
// TopicStepper — 主题进度条
// =============================================
// 横排展示 5 个主题的完成状态：
//   ✅ done  |  🔄 active  |  ○ todo
// 可点击切换当前主题
// =============================================

"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
type Topic = "education" | "internship" | "project" | "activity" | "skill";

interface TopicStepperProps {
  topics: Topic[];
  labels: Record<Topic, string>;
  statusFn: (t: Topic) => "done" | "active" | "todo";
  current: Topic;
  onSelect: (t: Topic) => void;
}

export function TopicStepper({
  topics,
  labels,
  statusFn,
  current,
  onSelect,
}: TopicStepperProps) {
  return (
    <div className="flex items-center gap-2 py-3 px-4 bg-white/5 rounded-xl border border-white/10">
      <span className="text-sm text-white/40 mr-2 whitespace-nowrap">
        Profile 构建进度
      </span>

      {topics.map((topic, i) => {
        const status = statusFn(topic);
        const isActive = topic === current;

        return (
          <div key={topic} className="flex items-center gap-2">
            {/* 连接线 */}
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  status === "done" ? "bg-green-500/60" : "bg-white/10"
                }`}
              />
            )}

            {/* 步骤节点 */}
            <motion.button
              onClick={() => onSelect(topic)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : status === "done"
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {status === "done" ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : status === "active" ? (
                <Loader2 size={14} className="animate-spin text-blue-400" />
              ) : (
                <Circle size={14} />
              )}
              {labels[topic]}
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
