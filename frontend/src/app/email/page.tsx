// =============================================
// 邮件通知页 — 双通道邮件同步 + AI 校招分类
// =============================================
// 通道 A: Gmail OAuth（需 GCP Console）
// 通道 B: IMAP 直连（QQ/163/Gmail/Outlook）
// 功能：邮件同步 → 8 种校招分类 → 自动日历
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card, CardBody, Button, Chip, Input, Select, SelectItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure,
} from "@nextui-org/react";
import {
  Mail, RefreshCw, Link2, Building2, MapPin, Clock,
  Shield, Inbox, AlertCircle, CalendarPlus,
} from "lucide-react";
import {
  useNotifications, useEmailStatus, syncEmails, getEmailAuthUrl,
  imapConnect, autoFillCalendar,
} from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// ---- category → 颜色映射 ----
const CATEGORY_COLOR: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
  application: "default",
  written_test: "secondary",
  assessment: "secondary",
  interview_1: "primary",
  interview_2: "primary",
  interview_hr: "warning",
  offer: "success",
  rejection: "danger",
  unknown: "default",
};

// ---- IMAP 邮箱预设 ----
const PROVIDERS = [
  { key: "qq", label: "QQ邮箱" },
  { key: "163", label: "163邮箱" },
  { key: "126", label: "126邮箱" },
  { key: "gmail", label: "Gmail" },
  { key: "outlook", label: "Outlook / 365" },
];

export default function EmailPage() {
  const { data: notifications, mutate } = useNotifications();
  const { data: emailStatus, mutate: mutateStatus } = useEmailStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // IMAP 表单状态
  const [imapProvider, setImapProvider] = useState("qq");
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapLoading, setImapLoading] = useState(false);
  const [imapError, setImapError] = useState("");

  const isConnected = emailStatus?.connected ?? false;
  const isGmail = emailStatus?.gmail_connected ?? false;
  const isImap = emailStatus?.imap_connected ?? false;

  /** Gmail OAuth */
  const handleAuth = async () => {
    const res = await getEmailAuthUrl();
    if (res.auth_url) window.location.href = res.auth_url;
  };

  /** IMAP 连接 */
  const handleImapConnect = async (onClose: () => void) => {
    setImapLoading(true);
    setImapError("");
    const { ok, data } = await imapConnect({
      user: imapUser,
      password: imapPassword,
      provider: imapProvider,
    });
    setImapLoading(false);
    if (ok) {
      await mutateStatus();
      onClose();
    } else {
      setImapError(data?.message || "连接失败");
    }
  };

  /** 邮件同步 */
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult("");
    try {
      const res = await syncEmails();
      if (res.synced !== undefined) {
        setSyncResult(
          `已同步 ${res.synced} 条通知（共发现 ${res.total_found} 封邮件），自动创建 ${res.calendar_created ?? 0} 个日历事件`
        );
      } else {
        setSyncResult(res.message || "同步完成");
      }
    } catch {
      setSyncResult("同步失败，请检查网络");
    }
    await mutate();
    await mutateStatus();
    setSyncing(false);
  };

  /** 自动补建日历 */
  const handleAutoFill = async () => {
    const res = await autoFillCalendar();
    setSyncResult(`已补建 ${res.created} 个日历事件（扫描 ${res.scanned} 条通知）`);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* 标题栏 */}
      <motion.div variants={item} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">邮件面试通知</h1>
        <div className="flex gap-2">
          <Button
            startContent={<Link2 size={16} />}
            variant="flat" size="sm"
            color={isGmail ? "success" : "default"}
            onPress={handleAuth}
          >
            {isGmail ? "Gmail已连" : "授权Gmail"}
          </Button>
          <Button
            startContent={<Inbox size={16} />}
            variant="flat" size="sm"
            color={isImap ? "success" : "secondary"}
            onPress={onOpen}
          >
            {isImap ? `IMAP已连 (${emailStatus?.imap_host})` : "IMAP直连"}
          </Button>
          <Button
            startContent={<RefreshCw size={16} className={syncing ? "animate-spin" : ""} />}
            color="primary" size="sm"
            onPress={handleSync}
            isLoading={syncing}
            isDisabled={!isConnected}
          >
            同步邮件
          </Button>
          <Button
            startContent={<CalendarPlus size={16} />}
            variant="flat" size="sm"
            onPress={handleAutoFill}
          >
            补建日历
          </Button>
        </div>
      </motion.div>

      {/* 连接状态卡片 */}
      <motion.div variants={item}>
        <Card className="bg-white/5 border border-white/10">
          <CardBody className="flex flex-row items-center gap-4 p-4">
            <Mail className="text-blue-400" size={24} />
            <div className="flex-1">
              <p className="font-medium">邮箱状态</p>
              <p className="text-sm text-white/50">
                {isConnected ? (
                  <>
                    {isImap && `IMAP: ${emailStatus?.imap_user}`}
                    {isImap && isGmail && " + "}
                    {isGmail && "Gmail OAuth"}
                    {` · 已解析 ${notifications?.length ?? 0} 条通知`}
                  </>
                ) : (
                  "尚未连接邮箱。支持 QQ邮箱/163/Gmail IMAP直连（推荐）或 Gmail OAuth。"
                )}
              </p>
              {syncResult && (
                <p className="text-sm text-blue-300 mt-1">{syncResult}</p>
              )}
            </div>
            <Chip
              color={isConnected ? "success" : "warning"}
              variant="flat" size="sm"
            >
              {isConnected ? "已连接" : "未连接"}
            </Chip>
          </CardBody>
        </Card>
      </motion.div>

      {/* IMAP 连接弹窗 */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Shield size={20} />
                  IMAP 邮箱直连
                </div>
                <p className="text-sm text-white/50 font-normal">
                  QQ邮箱/163邮箱需要使用授权码（非登录密码）
                </p>
              </ModalHeader>
              <ModalBody>
                <Select
                  label="邮箱服务商"
                  selectedKeys={[imapProvider]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as string;
                    if (val) setImapProvider(val);
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.key}>{p.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="邮箱地址"
                  placeholder="your@qq.com"
                  value={imapUser}
                  onValueChange={setImapUser}
                />
                <Input
                  label="授权码 / 应用密码"
                  type="password"
                  placeholder="QQ邮箱→设置→账户→生成授权码"
                  value={imapPassword}
                  onValueChange={setImapPassword}
                />
                {imapError && (
                  <div className="flex items-center gap-2 text-danger text-sm">
                    <AlertCircle size={14} /> {imapError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>取消</Button>
                <Button
                  color="primary"
                  onPress={() => handleImapConnect(onClose)}
                  isLoading={imapLoading}
                  isDisabled={!imapUser || !imapPassword}
                >
                  测试并连接
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 通知列表 */}
      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <motion.div key={n.id} variants={item}>
              <Card className="bg-white/5 border border-white/10">
                <CardBody className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Chip
                        size="sm" variant="flat"
                        color={CATEGORY_COLOR[n.category] ?? "default"}
                      >
                        {n.category_display || n.category}
                      </Chip>
                      <h3 className="font-semibold text-blue-300">
                        {n.position || n.email_subject}
                      </h3>
                    </div>
                    {n.interview_time && (
                      <Chip size="sm" variant="flat" color="primary">
                        <Clock size={12} className="inline mr-1" />
                        {new Date(n.interview_time).toLocaleString("zh-CN")}
                      </Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    {n.company && (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} /> {n.company}
                      </span>
                    )}
                    {n.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {n.location}
                      </span>
                    )}
                  </div>
                  {n.action_required && (
                    <p className="text-sm text-yellow-300/80">
                      ⚡ {n.action_required}
                    </p>
                  )}
                  <p className="text-xs text-white/30">
                    来自: {n.email_from} · 解析于 {n.parsed_at}
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card className="bg-white/5 border border-white/10">
            <CardBody className="p-8 text-center text-white/40">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">暂无面试通知</p>
              <p className="text-sm">
                点击「IMAP直连」连接QQ邮箱/163邮箱，或通过「授权Gmail」连接Gmail
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
