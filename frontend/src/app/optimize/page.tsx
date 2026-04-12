"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Card, CardBody } from "@nextui-org/react";
import { ArrowRight, UserRound } from "lucide-react";
import { OptimizeWorkspace } from "./components/OptimizeWorkspace";

export default function OptimizePage() {
  const searchParams = useSearchParams();
  const workspaceSeedJobIds = useMemo(() => {
    const raw = searchParams.get("job_ids");
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 16 }}
      className="max-w-6xl mx-auto space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">AI 简历定制工作区</h1>
          <p className="text-sm text-white/45 mt-1">
            从档案已确认事实中按 JD 组装新简历，支持逐岗位与综合版两种生成策略。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            as={Link}
            href="/jobs"
            variant="flat"
            className="bg-white/10 text-white/75"
            endContent={<ArrowRight size={14} />}
          >
            去岗位池继续选岗
          </Button>
          <Button
            as={Link}
            href="/profile"
            variant="flat"
            className="bg-white/10 text-white/75"
            startContent={<UserRound size={14} />}
          >
            编辑个人档案
          </Button>
        </div>
      </div>

      <Card className="bg-white/[0.02] border border-white/[0.08]">
        <CardBody className="px-4 py-3 text-xs text-white/50 leading-6">
          生成规则：仅允许使用档案中已确认事实；每次生成都会新增一份简历，不会覆盖已有简历。
        </CardBody>
      </Card>

      <OptimizeWorkspace seedJobIds={workspaceSeedJobIds} />
    </motion.div>
  );
}
