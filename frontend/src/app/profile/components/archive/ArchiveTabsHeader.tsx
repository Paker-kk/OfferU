"use client";

import { Button, Card, CardBody } from "@nextui-org/react";
import { Settings2 } from "lucide-react";
import type { ArchiveTab } from "@/lib/personalArchive";

interface ArchiveTabsHeaderProps {
  activeTab: ArchiveTab;
  onTabChange: (tab: ArchiveTab) => void;
  onOpenSettings: () => void;
}

function TabButton(props: {
  active: boolean;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onPress}
      className={`bauhaus-panel-sm flex-1 p-3 text-left transition ${
        props.active ? "bg-[#e4ece6] ring-1 ring-black/20" : "bg-[var(--surface)] hover:-translate-y-[1px]"
      }`}
    >
      <div className="text-sm font-semibold text-black">{props.label}</div>
      <div className="mt-1 text-xs leading-relaxed text-black/65">{props.subtitle}</div>
    </button>
  );
}

export default function ArchiveTabsHeader(props: ArchiveTabsHeaderProps) {
  return (
    <Card className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
      <CardBody className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row">
          <TabButton
            active={props.activeTab === "resume"}
            label="简历档案"
            subtitle="用于简历生成、简历编辑和 AI 优化，保持精简表达。"
            onPress={() => props.onTabChange("resume")}
          />
          <TabButton
            active={props.activeTab === "application"}
            label="投递档案"
            subtitle="用于官网网申、一键填充和投递补充信息。"
            onPress={() => props.onTabChange("application")}
          />
        </div>
        <div className="flex items-center md:pl-2">
          <Button
            isIconOnly
            aria-label="打开同步设置"
            className="bauhaus-button bauhaus-button-outline !h-10 !min-w-10 !w-10 !px-0 !py-0"
            onPress={props.onOpenSettings}
          >
            <Settings2 size={16} />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
