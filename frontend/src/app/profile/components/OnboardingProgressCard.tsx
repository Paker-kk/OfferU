import { Card, CardBody, Chip } from "@nextui-org/react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ProfileTopic } from "@/lib/hooks";
import { profileUiTokens } from "./profileTokens";

type OnboardingStatus = {
  hasBaseInfo: boolean;
  hasRoles: boolean;
  hasGuidedContent: boolean;
  hasConfirmedBullets: boolean;
  hasNarrative: boolean;
};

interface OnboardingProgressCardProps {
  onboardingStatus: OnboardingStatus;
  completedTopics: Set<ProfileTopic>;
  currentTopic: ProfileTopic;
  coreTopicOrder: ProfileTopic[];
  resolveTopicLabel: (topic: string) => string;
}

export function OnboardingProgressCard({
  onboardingStatus,
  completedTopics,
  currentTopic,
  coreTopicOrder,
  resolveTopicLabel,
}: OnboardingProgressCardProps) {
  return (
    <Card className={profileUiTokens.card}>
      <CardBody className="p-4 space-y-3">
        <div className="text-sm font-semibold text-white/85">Onboarding 进度</div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "step1", label: "Step1 基础信息", done: onboardingStatus.hasBaseInfo },
            { key: "step2", label: "Step2 目标岗位", done: onboardingStatus.hasRoles },
            { key: "step3", label: "Step3 对话引导", done: onboardingStatus.hasGuidedContent },
            { key: "step4", label: "Step4 条目确认", done: onboardingStatus.hasConfirmedBullets },
            { key: "step5", label: "Step5 职业叙事", done: onboardingStatus.hasNarrative },
          ].map((item) => (
            <Chip
              key={item.key}
              size="sm"
              variant="flat"
              color={item.done ? "success" : "default"}
              className={item.done ? "" : profileUiTokens.mutedChip}
              startContent={
                item.done ? <CheckCircle2 size={13} className="text-emerald-300" /> : <Circle size={12} />
              }
            >
              {item.label}
            </Chip>
          ))}
        </div>

        <div className="text-xs text-white/50">主题进度</div>
        <div className="flex flex-wrap gap-2">
          {coreTopicOrder.map((key) => {
            const current = currentTopic === key;
            const done = completedTopics.has(key);
            return (
              <Chip
                key={key}
                size="sm"
                variant="flat"
                color={done ? "success" : current ? "secondary" : "default"}
                className={!done && !current ? profileUiTokens.mutedChip : ""}
                startContent={
                  done ? (
                    <CheckCircle2 size={13} className="text-emerald-300" />
                  ) : current ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Circle size={12} />
                  )
                }
              >
                {resolveTopicLabel(key)}
              </Chip>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
