import { Button, Input, Textarea } from "@nextui-org/react";
import { AlertTriangle, PencilLine, Save, Trash2, X } from "lucide-react";
import { ProfileSection } from "@/lib/hooks";
import { profileUiTokens } from "./profileTokens";

interface StoredSectionItemCardProps {
  section: ProfileSection;
  lowConfidence: boolean;
  bulletText: string;
  isEditing: boolean;
  editingTitle: string;
  editingBullet: string;
  isSaving: boolean;
  isDeleting: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onTitleChange: (value: string) => void;
  onBulletChange: (value: string) => void;
}

export function StoredSectionItemCard({
  section,
  lowConfidence,
  bulletText,
  isEditing,
  editingTitle,
  editingBullet,
  isSaving,
  isDeleting,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onTitleChange,
  onBulletChange,
}: StoredSectionItemCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-1 ${
        lowConfidence ? "border-warning-400/50 bg-warning-500/10" : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {isEditing ? (
          <Input
            size="sm"
            variant="bordered"
            value={editingTitle}
            onValueChange={onTitleChange}
            autoFocus
            className="flex-1"
            classNames={{ inputWrapper: profileUiTokens.inputWrapper }}
          />
        ) : (
          <p className="text-sm font-medium text-white/85">{section.title || "未命名条目"}</p>
        )}

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                className="text-white/70 bg-white/10"
                onPress={onCancelEdit}
                isDisabled={isSaving}
              >
                <X size={14} />
              </Button>
              <Button size="sm" color="primary" isIconOnly isLoading={isSaving} onPress={onSave}>
                <Save size={14} />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                className="text-white/70"
                onPress={onStartEdit}
              >
                <PencilLine size={14} />
              </Button>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                className="text-danger-300"
                isLoading={isDeleting}
                onPress={onDelete}
              >
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <Textarea
          size="sm"
          variant="bordered"
          minRows={2}
          value={editingBullet}
          onValueChange={onBulletChange}
          description="快捷键: Ctrl/Cmd + Enter 保存"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          classNames={{ inputWrapper: profileUiTokens.inputWrapper }}
        />
      ) : (
        <p className="text-xs text-white/50 leading-relaxed break-words">{bulletText}</p>
      )}

      <div className={`text-[11px] ${lowConfidence ? "text-warning-200/90" : "text-white/25"}`}>
        来源 {section.source} · 置信度 {(section.confidence * 100).toFixed(0)}%
      </div>

      {lowConfidence && (
        <div className="text-[11px] text-warning-200/90 flex items-center gap-1">
          <AlertTriangle size={12} />
          低置信度条目，建议先核实再用于投递。
        </div>
      )}
    </div>
  );
}
