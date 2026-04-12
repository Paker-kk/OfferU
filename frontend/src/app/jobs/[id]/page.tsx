// =============================================
// 岗位详情页 — 单岗位完整信息
// =============================================
// 路由: /jobs/[id]
// 展示岗位全部信息：标题、公司、AI摘要、关键词
// =============================================

"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  Chip,
  Button,
  Spinner,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@nextui-org/react";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  Send,
} from "lucide-react";
import { createApplication, patchJob, useJob, usePools } from "@/lib/hooks";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id ? Number(params.id) : null;
  const { data: job, isLoading, error } = useJob(jobId);
  const { data: pickedPools } = usePools("picked");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const [targetPool, setTargetPool] = useState<string>("ungrouped");
  const [actionLoading, setActionLoading] = useState<"join" | "trash" | null>(null);

  const poolOptions = useMemo(() => {
    return [
      { key: "ungrouped", label: "未分组" },
      ...((pickedPools || []).map((pool) => ({ key: String(pool.id), label: pool.name }))),
    ];
  }, [pickedPools]);

  const handleJoinPicked = async () => {
    if (!job) return;
    try {
      setActionLoading("join");
      if (targetPool === "ungrouped") {
        await patchJob(job.id, { triage_status: "picked", clear_pool: true });
      } else {
        await patchJob(job.id, { triage_status: "picked", pool_id: Number(targetPool) });
      }
      setJoinModalOpen(false);
      router.push("/jobs?tab=picked");
    } catch (err: any) {
      alert(err?.message || "加入已筛选失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveToTrash = async () => {
    if (!job) return;
    try {
      setActionLoading("trash");
      await patchJob(job.id, { triage_status: "ignored" });
      setTrashConfirmOpen(false);
      router.push("/jobs?tab=ignored");
    } catch (err: any) {
      alert(err?.message || "移入回收站失败");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-white/50">岗位不存在或加载失败</p>
        <Button variant="bordered" onPress={() => router.push("/jobs")}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6 max-w-4xl"
    >
      {/* 顶栏：返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          onPress={() => router.push("/jobs")}
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-white/60 text-sm">
            <span className="flex items-center gap-1">
              <Building2 size={14} /> {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {job.location}
            </span>
            {job.posted_at && (
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {job.posted_at}
              </span>
            )}
            <Chip size="sm" variant="flat">
              {job.source}
            </Chip>
          </div>
        </div>
      </div>

      {/* AI 摘要 */}
      {job.summary && (
        <Card className="bg-white/5 border border-white/10">
          <CardBody>
            <h3 className="text-lg font-semibold mb-2">AI 摘要</h3>
            <p className="text-white/70 leading-relaxed">{job.summary}</p>
          </CardBody>
        </Card>
      )}

      {/* 完整 JD（仅在二级详情页展示） */}
      <Card className="bg-white/5 border border-white/10">
        <CardBody>
          <h3 className="text-lg font-semibold mb-2">职位描述（完整 JD）</h3>
          {job.raw_description ? (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10 bg-black/20 p-4">
              <pre className="whitespace-pre-wrap text-sm text-white/75 leading-relaxed font-sans">
                {job.raw_description}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-white/45">暂无 JD 原文内容</p>
          )}
        </CardBody>
      </Card>

      {/* 关键词 */}
      {job.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.keywords.map((kw) => (
            <Chip key={kw} size="sm" variant="flat" className="bg-white/10">
              {kw}
            </Chip>
          ))}
        </div>
      )}

      {/* 操作按钮（两行两列） */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-11 w-full bg-blue-600 text-white hover:bg-blue-500"
          onPress={() => setJoinModalOpen(true)}
          isLoading={actionLoading === "join"}
        >
          加入已筛选
        </Button>
        <Button
          className="h-11 w-full bg-amber-500 text-white hover:bg-amber-400"
          onPress={() => setTrashConfirmOpen(true)}
          isLoading={actionLoading === "trash"}
          isDisabled={actionLoading === "join"}
        >
          移入回收站
        </Button>

        {job.url ? (
          <Button
            as={Link}
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="bordered"
            className="h-11 w-full border-white/25 text-white/70 hover:bg-white/5"
            endContent={<ExternalLink size={16} />}
          >
            查看原文
          </Button>
        ) : (
          <Button
            variant="bordered"
            isDisabled
            className="h-11 w-full border-white/15 text-white/35"
          >
            查看原文
          </Button>
        )}

        <Button
          color="success"
          endContent={<Send size={16} />}
          className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
          onPress={async () => {
            await createApplication(job.id);
            router.push("/applications");
          }}
        >
          一键投递
        </Button>
      </div>

      <Modal isOpen={joinModalOpen} onClose={() => setJoinModalOpen(false)} size="md">
        <ModalContent>
          <ModalHeader>加入已筛选</ModalHeader>
          <ModalBody className="space-y-3">
            <p className="text-sm text-white/60">选择目标池，确认后将该岗位流转到已筛选。</p>
            <Select
              aria-label="目标已筛选池"
              selectedKeys={[targetPool]}
              onSelectionChange={(keys) => setTargetPool(Array.from(keys)[0] as string)}
              items={poolOptions}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setJoinModalOpen(false)}>取消</Button>
            <Button color="primary" onPress={handleJoinPicked} isLoading={actionLoading === "join"}>
              确认加入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={trashConfirmOpen} onClose={() => setTrashConfirmOpen(false)} size="md">
        <ModalContent>
          <ModalHeader>移入回收站</ModalHeader>
          <ModalBody>
            <p className="text-sm text-white/70">
              确认将该岗位移入回收站吗？移入后可在回收站页面恢复或永久删除。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setTrashConfirmOpen(false)}>
              取消
            </Button>
            <Button color="danger" isLoading={actionLoading === "trash"} onPress={handleMoveToTrash}>
              确认移入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
