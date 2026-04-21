// =============================================
// Pool 管理栏 — 已筛选 Tab 头部 inline 操作
// =============================================
// 功能：池过滤芯片 + 创建/改名/删除池
// 位置：已筛选 Tab 内，筛选栏上方
// =============================================

"use client";

import { useState, useCallback } from "react";
import {
  Chip,
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@nextui-org/react";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { poolsApi } from "@/lib/api";
import type { Pool } from "@/lib/hooks";

interface PoolManagerProps {
  pools: Pool[];
  activePoolId: number | string | undefined;
  onSelectPool: (id: number | string | undefined) => void;
  onMutate: () => void;
}

export function PoolManager({ pools, activePoolId, onSelectPool, onMutate }: PoolManagerProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await poolsApi.create({ name: newName.trim() });
    setNewName("");
    setIsCreating(false);
    onMutate();
  }, [newName, onMutate]);

  const handleRename = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    await poolsApi.update(editingId, { name: editName.trim() });
    setEditingId(null);
    setEditName("");
    onMutate();
  }, [editingId, editName, onMutate]);

  const handleDelete = useCallback(async (id: number) => {
    await poolsApi.delete(id);
    if (activePoolId === id) onSelectPool(undefined);
    onMutate();
  }, [activePoolId, onSelectPool, onMutate]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-black/[0.03] border border-black/10">
      <FolderOpen size={16} className="text-black/40 shrink-0" />

      {/* 全部 */}
      <Chip
        variant={activePoolId === undefined ? "solid" : "flat"}
        color={activePoolId === undefined ? "primary" : "default"}
        className="cursor-pointer"
        onClick={() => onSelectPool(undefined)}
      >
        全部
      </Chip>

      {/* 各 Pool */}
      {pools.map((pool) => (
        <Popover key={pool.id} placement="bottom">
          <PopoverTrigger>
            <Chip
              variant={activePoolId === pool.id ? "solid" : "flat"}
              color={activePoolId === pool.id ? "primary" : "default"}
              className="cursor-pointer"
              onClick={() => onSelectPool(pool.id)}
            >
              {pool.name}
              {pool.job_count > 0 && (
                <span className="ml-1 text-xs opacity-60">{pool.job_count}</span>
              )}
            </Chip>
          </PopoverTrigger>
          <PopoverContent className="bg-zinc-800 border border-white/10 p-3 space-y-2">
            {editingId === pool.id ? (
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  value={editName}
                  onValueChange={setEditName}
                  placeholder="新名称"
                  classNames={{ inputWrapper: "bg-white/5 border border-white/10" }}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  autoFocus
                />
                <Button size="sm" color="primary" onPress={handleRename}>
                  保存
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Pencil size={12} />}
                  onPress={() => {
                    setEditingId(pool.id);
                    setEditName(pool.name);
                  }}
                >
                  改名
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  startContent={<Trash2 size={12} />}
                  onPress={() => handleDelete(pool.id)}
                >
                  删除
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      ))}

      {/* 未分组 */}
      <Chip
        variant={activePoolId === "null" ? "solid" : "flat"}
        color={activePoolId === "null" ? "warning" : "default"}
        className="cursor-pointer"
        onClick={() => onSelectPool("null")}
      >
        未分组
      </Chip>

      {/* 创建新池 */}
      {isCreating ? (
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            value={newName}
            onValueChange={setNewName}
            placeholder="新Pool名称"
            classNames={{
              base: "w-32",
              inputWrapper: "bg-black/5 border border-black/10",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <Button size="sm" color="primary" isIconOnly onPress={handleCreate}>
            <Plus size={14} />
          </Button>
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => {
              setIsCreating(false);
              setNewName("");
            }}
          >
            ✕
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="light"
          startContent={<Plus size={14} />}
          onPress={() => setIsCreating(true)}
          className="text-black/50"
        >
          新建池
        </Button>
      )}
    </div>
  );
}
