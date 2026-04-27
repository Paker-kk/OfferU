"use client";

import { Button, Card, CardBody } from "@nextui-org/react";
import { Save, Upload } from "lucide-react";

interface ArchiveIntroCardProps {
  onImport: () => void;
  onSave: () => void;
  saving: boolean;
  importing: boolean;
}

export default function ArchiveIntroCard(props: ArchiveIntroCardProps) {
  return (
    <Card className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
      <CardBody className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="bauhaus-label text-black/60">个人职业信息中心</p>
          <h1 className="text-3xl font-bold text-black md:text-4xl">个人档案库</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-black/70 md:text-base">
            统一管理用于简历生成与官网投递的个人职业信息。简历档案用于生成简历，投递档案用于官网网申与插件填表。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button
            startContent={<Upload size={14} />}
            isLoading={props.importing}
            className="bauhaus-button bauhaus-button-outline !px-4 !py-2 !text-[11px]"
            onPress={props.onImport}
          >
            智能导入
          </Button>
          <Button
            startContent={<Save size={14} />}
            isLoading={props.saving}
            className="bauhaus-button bauhaus-button-blue !px-4 !py-2 !text-[11px]"
            onPress={props.onSave}
          >
            保存
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
