import { Button, Chip, Input, Textarea } from "@nextui-org/react";
import { AlertTriangle, Check } from "lucide-react";
import { CandidateDraft } from "./types";
import { profileUiTokens } from "./profileTokens";

interface CandidateItemCardProps {
  item: CandidateDraft;
  lowConfidence: boolean;
  sectionLabel: string;
  isConfirming: boolean;
  onTitleChange: (value: string) => void;
  onBulletChange: (value: string) => void;
  onConfirm: () => void;
}

export function CandidateItemCard({
  item,
  lowConfidence,
  sectionLabel,
  isConfirming,
  onTitleChange,
  onBulletChange,
  onConfirm,
}: CandidateItemCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        lowConfidence ? "border-warning-400/50 bg-warning-500/10" : "border-white/[0.08]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip size="sm" variant="flat" className={profileUiTokens.sectionChip}>
          {sectionLabel}
        </Chip>
        <span className={`text-xs ${lowConfidence ? "text-warning-200/95" : "text-white/35"}`}>
          置信度 {(item.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {lowConfidence && (
        <div className="text-xs text-warning-200/95 flex items-center gap-1">
          <AlertTriangle size={12} />
          低置信度，请优先核实数据与事实。
        </div>
      )}

      <Input
        size="sm"
        variant="bordered"
        label="标题"
        value={item.titleDraft}
        onValueChange={onTitleChange}
        classNames={{ inputWrapper: profileUiTokens.inputWrapper }}
      />

      <Textarea
        size="sm"
        variant="bordered"
        label="Bullet"
        minRows={2}
        value={item.bulletDraft}
        onValueChange={onBulletChange}
        classNames={{ inputWrapper: profileUiTokens.inputWrapper }}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          color={item.confirmed ? "success" : "primary"}
          variant={item.confirmed ? "flat" : "solid"}
          startContent={item.confirmed ? <Check size={14} /> : undefined}
          isLoading={isConfirming}
          isDisabled={item.confirmed}
          onPress={onConfirm}
        >
          {item.confirmed ? "已确认入库" : "确认入库"}
        </Button>
      </div>
    </div>
  );
}
