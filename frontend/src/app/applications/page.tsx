// =============================================
// 投递管理页 — Auto-apply 自动投递跟踪
// =============================================
// 功能：
//   - 投递记录列表（按状态筛选）
//   - AI 生成求职信
//   - 投递状态追踪（pending → submitted → interview → offer）
//   - 一键更新状态
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card, CardBody, Button, Chip, Tabs, Tab,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, useDisclosure, Pagination,
} from "@nextui-org/react";
import {
  Send, Sparkles, Building2, ExternalLink, FileText,
  Clock, CheckCircle, XCircle, MessageSquare,
} from "lucide-react";
import {
  useApplications, useApplicationStats,
  updateApplication, generateCoverLetter,
} from "@/lib/hooks";

const statusConfig: Record<string, { label: string; color: "default" | "primary" | "warning" | "success" | "danger" }> = {
  pending: { label: "待投递", color: "default" },
  submitted: { label: "已投递", color: "primary" },
  rejected: { label: "已拒绝", color: "danger" },
  interview: { label: "面试中", color: "warning" },
  offer: { label: "已录用", color: "success" },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { data: appsData, mutate } = useApplications(
    page, statusFilter === "all" ? undefined : statusFilter
  );
  const { data: stats } = useApplicationStats();

  // 求职信弹窗
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);

  /** 打开求职信弹窗 */
  const openCoverLetter = (app: any) => {
    setSelectedApp(app);
    setCoverLetter(app.cover_letter || "");
    onOpen();
  };

  /** AI 生成求职信 */
  const handleGenerate = async () => {
    if (!selectedApp) return;
    setGenerating(true);
    const result = await generateCoverLetter(selectedApp.job_id, 1); // 默认使用简历ID=1
    if (result.cover_letter) {
      setCoverLetter(result.cover_letter);
    }
    setGenerating(false);
  };

  /** 保存求职信 */
  const handleSaveCoverLetter = async () => {
    if (!selectedApp) return;
    await updateApplication(selectedApp.id, { cover_letter: coverLetter });
    onClose();
    mutate();
  };

  /** 更新投递状态 */
  const handleStatusChange = async (appId: number, newStatus: string) => {
    await updateApplication(appId, { status: newStatus });
    mutate();
  };

  const totalPages = appsData ? Math.ceil(appsData.total / appsData.page_size) : 1;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">投递管理</h1>
      </motion.div>

      {/* 状态统计 */}
      <motion.div variants={item} className="flex gap-3 flex-wrap">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <Chip
            key={key}
            variant="flat"
            color={cfg.color}
            className="cursor-pointer"
          >
            {cfg.label}: {stats?.[key] ?? 0}
          </Chip>
        ))}
      </motion.div>

      {/* 筛选 Tabs */}
      <motion.div variants={item}>
        <Tabs
          selectedKey={statusFilter}
          onSelectionChange={(k) => { setStatusFilter(k as string); setPage(1); }}
          size="sm"
        >
          <Tab key="all" title="全部" />
          <Tab key="pending" title="待投递" />
          <Tab key="submitted" title="已投递" />
          <Tab key="interview" title="面试中" />
          <Tab key="offer" title="已录用" />
          <Tab key="rejected" title="已拒绝" />
        </Tabs>
      </motion.div>

      {/* 投递列表 */}
      {appsData && appsData.items.length > 0 ? (
        <div className="space-y-3">
          {appsData.items.map((app) => {
            const cfg = statusConfig[app.status] || statusConfig.pending;
            return (
              <motion.div key={app.id} variants={item}>
                <Card className="bg-white/5 border border-white/10">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-300">
                          {app.job_title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-white/50 mt-1">
                          <Building2 size={12} /> {app.job_company}
                          <Clock size={12} className="ml-2" />
                          {new Date(app.created_at).toLocaleDateString("zh-CN")}
                        </div>
                        {app.notes && (
                          <p className="text-xs text-white/40 mt-2">{app.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip size="sm" color={cfg.color} variant="flat">
                          {cfg.label}
                        </Chip>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<FileText size={14} />}
                        onPress={() => openCoverLetter(app)}
                      >
                        求职信
                      </Button>

                      {app.status === "pending" && (
                        <Button
                          size="sm"
                          color="primary"
                          startContent={<Send size={14} />}
                          onPress={() => handleStatusChange(app.id, "submitted")}
                        >
                          标记已投
                        </Button>
                      )}
                      {app.status === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            startContent={<MessageSquare size={14} />}
                            onPress={() => handleStatusChange(app.id, "interview")}
                          >
                            进入面试
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<XCircle size={14} />}
                            onPress={() => handleStatusChange(app.id, "rejected")}
                          >
                            已拒绝
                          </Button>
                        </>
                      )}
                      {app.status === "interview" && (
                        <Button
                          size="sm"
                          color="success"
                          startContent={<CheckCircle size={14} />}
                          onPress={() => handleStatusChange(app.id, "offer")}
                        >
                          收到Offer
                        </Button>
                      )}

                      {app.apply_url && (
                        <Button
                          size="sm"
                          variant="light"
                          as="a"
                          href={app.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          startContent={<ExternalLink size={14} />}
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
            <div className="flex justify-center pt-4">
              <Pagination total={totalPages} page={page} onChange={setPage} />
            </div>
          )}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card className="bg-white/5 border border-white/10">
            <CardBody className="p-8 text-center text-white/40">
              <Send size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">暂无投递记录</p>
              <p className="text-sm">在岗位详情页点击"一键投递"来创建记录</p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* 求职信编辑 Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" placement="center">
        <ModalContent className="bg-[#1a1a2e] border border-white/10">
          <ModalHeader>
            {selectedApp?.job_title} — 求职信
          </ModalHeader>
          <ModalBody>
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                color="secondary"
                variant="flat"
                startContent={<Sparkles size={14} />}
                isLoading={generating}
                onPress={handleGenerate}
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
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>取消</Button>
            <Button color="primary" onPress={handleSaveCoverLetter}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
