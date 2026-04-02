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
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@nextui-org/react";
import { Plus, FileText, Trash2, Edit3, Globe } from "lucide-react";
import { useResumes, createResume, deleteResume } from "@/lib/hooks";

export default function ResumesListPage() {
  const router = useRouter();
  const { data: resumes, mutate } = useResumes();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newTitle, setNewTitle] = useState("未命名简历");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  /** 创建新简历并跳转到编辑器 */
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await createResume({
      user_name: newName,
      title: newTitle,
    });
    setCreating(false);
    onClose();
    mutate(); // 刷新列表
    if (res?.id) {
      router.push(`/resume/${res.id}`);
    }
  };

  /** 删除简历 */
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这份简历吗？此操作不可撤销。")) return;
    await deleteResume(id);
    mutate();
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

      {/* 简历卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {(resumes || []).map((resume: any, i: number) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                isPressable
                className="bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                onPress={() => router.push(`/resume/${resume.id}`)}
              >
                <CardBody className="p-5 space-y-3">
                  {/* 缩略图占位 */}
                  <div className="aspect-[210/297] rounded-lg bg-gradient-to-br from-white/5 to-white/2 border border-white/8 flex items-center justify-center relative overflow-hidden">
                    <FileText size={40} className="text-white/15" />
                    {/* 装饰性顶部色条 */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/40 to-purple-500/40" />
                  </div>

                  {/* 简历信息 */}
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm truncate">{resume.title || "未命名简历"}</h3>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <span>{resume.user_name}</span>
                      {resume.language && (
                        <span className="flex items-center gap-0.5">
                          <Globe size={10} />
                          {resume.language === "zh" ? "中文" : resume.language === "en" ? "English" : resume.language}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/30">
                      更新于 {new Date(resume.updated_at).toLocaleDateString("zh-CN")}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      onPress={(e: any) => handleDelete(resume.id, e)}
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
              label="你的姓名"
              variant="bordered"
              value={newName}
              onValueChange={setNewName}
              autoFocus
            />
            <Input
              label="简历标题"
              variant="bordered"
              value={newTitle}
              onValueChange={setNewTitle}
              placeholder="如：前端工程师-中文版"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>取消</Button>
            <Button color="primary" isLoading={creating} onPress={handleCreate} isDisabled={!newName.trim()}>
              创建并编辑
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
