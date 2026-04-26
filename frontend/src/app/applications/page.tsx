"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Tab,
  Tabs,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import {
  Building2,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  generateCoverLetter,
  updateApplication,
  useApplications,
  useApplicationStats,
} from "@/lib/hooks";
import {
  bauhausFieldClassNames,
  bauhausModalContentClassName,
  bauhausTabsClassNames,
} from "@/lib/bauhaus";

const statusConfig: Record<
  string,
  {
    label: string;
    chipClass: string;
    panelClass: string;
  }
> = {
  pending: {
    label: "待投递",
    chipClass: "border-2 border-black bg-white text-black font-semibold",
    panelClass: "bg-white text-black",
  },
  submitted: {
    label: "已投递",
    chipClass: "border-2 border-black bg-[#1040C0] text-white font-semibold",
    panelClass: "bg-[#1040C0] text-white",
  },
  rejected: {
    label: "已拒绝",
    chipClass: "border-2 border-black bg-[#D02020] text-white font-semibold",
    panelClass: "bg-[#D02020] text-white",
  },
  interview: {
    label: "面试中",
    chipClass: "border-2 border-black bg-[#F0C020] text-black font-semibold",
    panelClass: "bg-[#F0C020] text-black",
  },
  offer: {
    label: "已录用",
    chipClass: "border-2 border-black bg-black text-white font-semibold",
    panelClass: "bg-black text-white",
  },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
};

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { data: appsData, mutate } = useApplications(
    page,
    statusFilter === "all" ? undefined : statusFilter
  );
  const { data: stats } = useApplicationStats();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);

  const openCoverLetter = (app: any) => {
    setSelectedApp(app);
    setCoverLetter(app.cover_letter || "");
    onOpen();
  };

  const handleGenerate = async () => {
    if (!selectedApp) return;
    setGenerating(true);
    const result = await generateCoverLetter(selectedApp.job_id, 1);
    if (result.cover_letter) setCoverLetter(result.cover_letter);
    setGenerating(false);
  };

  const handleSaveCoverLetter = async () => {
    if (!selectedApp) return;
    await updateApplication(selectedApp.id, { cover_letter: coverLetter });
    onClose();
    mutate();
  };

  const handleStatusChange = async (appId: number, newStatus: string) => {
    await updateApplication(appId, { status: newStatus });
    mutate();
  };

  const totalPages = appsData ? Math.ceil(appsData.total / appsData.page_size) : 1;

  const statBlocks = [
    { key: "pending", label: "待投递", count: stats?.pending ?? 0, surface: "bg-white text-black" },
    { key: "submitted", label: "已投递", count: stats?.submitted ?? 0, surface: "bg-[#1040C0] text-white" },
    { key: "interview", label: "面试中", count: stats?.interview ?? 0, surface: "bg-[#F0C020] text-black" },
    { key: "offer", label: "已录用", count: stats?.offer ?? 0, surface: "bg-[#D02020] text-white" },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.section variants={item} className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#F0C020]">Application Grid</span>
            <div>
              <p className="bauhaus-label text-black/55">Pipeline Monitor</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Track
                <br />
                Follow
                <br />
                Close
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                把待投递、面试推进和 Offer 收口放在同一张工作面板里，方便我们快速判断当前漏斗卡在哪一步，
                以及哪些岗位需要补求职信或后续动作。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {statBlocks.map((block) => (
              <div key={block.key} className={`bauhaus-panel-sm p-4 ${block.surface}`}>
                <p className={`bauhaus-label ${block.surface.includes("text-white") ? "text-white/70" : "text-black/55"}`}>
                  {block.label}
                </p>
                <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">{block.count}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          selectedKey={statusFilter}
          onSelectionChange={(key) => {
            setStatusFilter(key as string);
            setPage(1);
          }}
          size="sm"
          classNames={bauhausTabsClassNames}
        >
          <Tab key="all" title="全部" />
          <Tab key="pending" title="待投递" />
          <Tab key="submitted" title="已投递" />
          <Tab key="interview" title="面试中" />
          <Tab key="offer" title="已录用" />
          <Tab key="rejected" title="已拒绝" />
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <Chip key={key} variant="flat" className={`${cfg.chipClass} cursor-pointer`}>
              {cfg.label}: {stats?.[key] ?? 0}
            </Chip>
          ))}
        </div>
      </motion.section>

      {appsData && appsData.items.length > 0 ? (
        <div className="space-y-4">
          {appsData.items.map((app) => {
            const cfg = statusConfig[app.status] || statusConfig.pending;
            return (
              <motion.div key={app.id} variants={item}>
                <Card className="bauhaus-panel rounded-none bg-white shadow-none">
                  <CardBody className="space-y-4 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip size="sm" variant="flat" className={cfg.chipClass}>
                            {cfg.label}
                          </Chip>
                          <span className="bauhaus-label text-black/45">Pipeline Entry</span>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-[-0.05em] text-black">{app.job_title}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-black/60">
                            <span className="flex items-center gap-1">
                              <Building2 size={13} />
                              {app.job_company}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={13} />
                              {new Date(app.created_at).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                          {app.notes && (
                            <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-black/68">
                              {app.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className={`bauhaus-panel-sm min-w-[180px] px-4 py-3 ${cfg.panelClass}`}>
                        <p className={`bauhaus-label ${cfg.panelClass.includes("text-white") ? "text-white/70" : "text-black/55"}`}>
                          Current State
                        </p>
                        <p className="mt-2 text-lg font-black uppercase tracking-[-0.04em]">{cfg.label}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        startContent={<FileText size={14} />}
                        onPress={() => openCoverLetter(app)}
                        className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
                      >
                        求职信
                      </Button>

                      {app.status === "pending" && (
                        <Button
                          size="sm"
                          startContent={<Send size={14} />}
                          onPress={() => handleStatusChange(app.id, "submitted")}
                          className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
                        >
                          标记已投
                        </Button>
                      )}

                      {app.status === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            startContent={<MessageSquare size={14} />}
                            onPress={() => handleStatusChange(app.id, "interview")}
                            className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]"
                          >
                            进入面试
                          </Button>
                          <Button
                            size="sm"
                            startContent={<XCircle size={14} />}
                            onPress={() => handleStatusChange(app.id, "rejected")}
                            className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
                          >
                            已拒绝
                          </Button>
                        </>
                      )}

                      {app.status === "interview" && (
                        <Button
                          size="sm"
                          startContent={<CheckCircle size={14} />}
                          onPress={() => handleStatusChange(app.id, "offer")}
                          className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
                        >
                          收到 Offer
                        </Button>
                      )}

                      {app.apply_url && (
                        <Button
                          size="sm"
                          as="a"
                          href={app.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          startContent={<ExternalLink size={14} />}
                          className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
                        >
                          申请链接
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            );
          })}

          {totalPages > 1 && (
            <motion.div variants={item} className="flex justify-center pt-2">
              <Pagination total={totalPages} page={page} onChange={setPage} />
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card className="bauhaus-panel rounded-none bg-[#1040C0] text-white shadow-none">
            <CardBody className="p-10 text-center">
              <Send size={54} className="mx-auto" />
              <p className="mt-4 text-2xl font-black uppercase tracking-[-0.05em]">No Applications Yet</p>
              <p className="mt-3 text-sm font-medium text-white/80">
                在岗位详情页点击「一键投递」，这里就会开始形成完整的投递看板。
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="2xl" placement="center">
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black bg-[#F0C020] px-6 py-5 text-xl font-black tracking-[-0.06em]">
            {selectedApp?.job_title} · 求职信
          </ModalHeader>
          <ModalBody className="px-6 py-6">
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                startContent={<Sparkles size={14} />}
                isLoading={generating}
                onPress={handleGenerate}
                className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
              >
                AI 生成
              </Button>
            </div>
            <Textarea
              variant="bordered"
              minRows={10}
              maxRows={20}
              placeholder="在此编写或使用 AI 生成求职信..."
              value={coverLetter}
              onValueChange={setCoverLetter}
              classNames={bauhausFieldClassNames}
            />
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button variant="light" onPress={onClose} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
              取消
            </Button>
            <Button onPress={handleSaveCoverLetter} className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]">
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
