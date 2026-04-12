// =============================================
// 简历列表页 — 简历管理入口
// =============================================
// 展示用户所有简历的卡片列表
// 支持：新建简历、删除简历、进入编辑器
// Figma/Notion 风格：简洁卡片 + 渐变装饰
// =============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, Button, Chip, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@nextui-org/react";
import { Plus, FileText, Trash2, Edit3, Globe } from "lucide-react";
import { ResumeBrief, useProfile, useResumes, createResume, deleteResume } from "@/lib/hooks";

function getResumeSourceLabel(resume: ResumeBrief): { text: string; color: "default" | "secondary" | "success" } {
  if (resume.source_mode === "per_job") {
    const first = resume.source_jobs?.[0];
    if (first) {
      return { text: `基于 ${first.company}-${first.title} 生成`, color: "secondary" };
    }
    const count = resume.source_job_ids?.length || 0;
    return { text: count > 0 ? `基于 ${count} 个岗位生成` : "AI 逐岗位生成", color: "secondary" };
  }

  if (resume.source_mode === "combined") {
    const count = resume.source_job_ids?.length || 0;
    return { text: count > 0 ? `综合 ${count} 个岗位生成` : "AI 综合生成", color: "success" };
  }

  return { text: "手动创建", color: "default" };
}

export default function ResumesListPage() {
  const router = useRouter();
  const { data: resumes, mutate } = useResumes();
  const { data: profileData } = useProfile();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newTitle, setNewTitle] = useState("未命名简历");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  /** 创建新简历并跳转到编辑器 */
  const handleCreate = async () => {
    try {
      setActionError("");
      setCreating(true);
      const profileName = String(profileData?.base_info_json?.name || profileData?.name || "").trim();
      const res = await createResume({
        user_name: profileName,
        title: newTitle.trim() || "未命名简历",
      });
      onClose();
      mutate();
      if (res?.id) {
        router.push(`/resume/${res.id}`);
      }
    } catch (err: any) {
      setActionError(err.message || "创建失败，请重试");
    } finally {
      setCreating(false);
    }
  };

  /** 删除简历 */
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这份简历吗？此操作不可撤销。")) return;
    try {
      setActionError("");
      setDeletingId(id);
      await deleteResume(id);
      mutate();
    } catch (err: any) {
      setActionError(err.message || "删除失败，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6"
    >
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">简历管理</h1>
          <p className="text-sm text-white/40 mt-1">创建和管理你的所有简历</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={16} />}
          onPress={onOpen}
        >
          新建简历
        </Button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-400/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">
          {actionError}
        </div>
      )}

      {/* 简历卡片网格 */}
      <div className="grid [grid-template-columns:repeat(1,minmax(0,1fr))] md:[grid-template-columns:repeat(3,minmax(0,1fr))] lg:[grid-template-columns:repeat(4,minmax(0,1fr))] xl:[grid-template-columns:repeat(5,minmax(0,1fr))] gap-5 items-stretch">
        <AnimatePresence>
          {(resumes || []).map((resume: ResumeBrief, i: number) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              className="min-w-0"
            >
              <Card
                isPressable
                className="bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group w-full h-full aspect-[3/5] min-h-[380px]"
                onPress={() => router.push(`/resume/${resume.id}`)}
              >
                <CardBody className="p-4 h-full flex flex-col gap-3">
                  {/* 缩略图占位 */}
                  <div className="h-[58%] min-h-[180px] rounded-lg bg-gradient-to-br from-white/5 to-white/2 border border-white/8 flex items-center justify-center relative overflow-hidden">
                    <FileText size={40} className="text-white/15" />
                    {/* 装饰性顶部色条 */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/40 to-purple-500/40" />
                  </div>

                  {/* 简历信息 */}
                  <div className="space-y-1.5 min-h-[96px]">
                    <h3 className="font-semibold text-sm text-white/85 truncate">{resume.title || "未命名简历"}</h3>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <span>{resume.user_name}</span>
                      {resume.language && (
                        <span className="flex items-center gap-0.5">
                          <Globe size={10} />
                          {resume.language === "zh" ? "中文" : resume.language === "en" ? "English" : resume.language}
                        </span>
                      )}
                    </div>
                    <div>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={getResumeSourceLabel(resume).color}
                        className="text-[10px]"
                      >
                        {getResumeSourceLabel(resume).text}
                      </Chip>
                    </div>
                    <p className="text-xs text-white/30">
                      更新于 {new Date(resume.updated_at).toLocaleDateString("zh-CN")}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Edit3 size={12} />}
                      className="flex-1"
                      onPress={() => router.push(`/resume/${resume.id}`)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      isIconOnly
                      className="text-red-400/70"
                      isLoading={deletingId === resume.id}
                      onClick={(e) => handleDelete(resume.id, e)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 空状态 */}
        {resumes && resumes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full flex flex-col items-center justify-center py-20 text-white/30"
          >
            <FileText size={48} className="mb-4" />
            <p className="text-lg">还没有简历</p>
            <p className="text-sm mt-1">点击右上角「新建简历」开始</p>
          </motion.div>
        )}
      </div>

      {/* 新建简历弹窗 */}
      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader>新建简历</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="简历命名"
              variant="bordered"
              value={newTitle}
              onValueChange={setNewTitle}
              autoFocus
              placeholder="如：前端工程师-中文版"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>取消</Button>
            <Button color="primary" isLoading={creating} onPress={handleCreate}>
              创建并编辑
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
