"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  useDisclosure,
} from "@nextui-org/react";
import {
  AlertCircle,
  Building2,
  CalendarPlus,
  Clock,
  Inbox,
  Info,
  Link2,
  Mail,
  MapPin,
  RefreshCw,
  Shield,
} from "lucide-react";
import {
  autoFillCalendar,
  getEmailAuthUrl,
  imapConnect,
  syncEmails,
  useEmailStatus,
  useNotifications,
} from "@/lib/hooks";
import {
  bauhausFieldClassNames,
  bauhausModalContentClassName,
  bauhausSelectClassNames,
} from "@/lib/bauhaus";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
};

const CATEGORY_CLASS: Record<string, string> = {
  application: "border-2 border-black bg-white text-black font-semibold",
  written_test: "border-2 border-black bg-[#1040C0] text-white font-semibold",
  assessment: "border-2 border-black bg-[#1040C0] text-white font-semibold",
  interview_1: "border-2 border-black bg-[#F0C020] text-black font-semibold",
  interview_2: "border-2 border-black bg-[#F0C020] text-black font-semibold",
  interview_hr: "border-2 border-black bg-[#D02020] text-white font-semibold",
  offer: "border-2 border-black bg-black text-white font-semibold",
  rejection: "border-2 border-black bg-[#D02020] text-white font-semibold",
  unknown: "border-2 border-black bg-white text-black font-semibold",
};

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
  const [syncResult, setSyncResult] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [imapProvider, setImapProvider] = useState("qq");
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapLoading, setImapLoading] = useState(false);
  const [imapError, setImapError] = useState("");

  const isConnected = emailStatus?.connected ?? false;
  const isGmail = emailStatus?.gmail_connected ?? false;
  const isImap = emailStatus?.imap_connected ?? false;

  const handleAuth = async () => {
    const result = await getEmailAuthUrl();
    if (result.auth_url) window.location.href = result.auth_url;
  };

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

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult("");
    try {
      const result = await syncEmails();
      if (result.synced !== undefined) {
        setSyncResult(
          `已同步 ${result.synced} 条通知（共发现 ${result.total_found} 封邮件），自动创建 ${result.calendar_created ?? 0} 个日历事件`
        );
      } else {
        setSyncResult(result.message || "同步完成");
      }
    } catch {
      setSyncResult("同步失败，请检查网络");
    }
    await mutate();
    await mutateStatus();
    setSyncing(false);
  };

  const handleAutoFill = async () => {
    const result = await autoFillCalendar();
    setSyncResult(`已补建 ${result.created} 个日历事件（扫描 ${result.scanned} 条通知）`);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.section variants={item} className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#F0C020]">Mail Intake</span>
            <div>
              <p className="bauhaus-label text-black/55">Inbox Parser</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Read
                <br />
                Parse
                <br />
                Route
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                把邮箱授权、通知分类和日历同步集中到一块面板里，避免面试邮件遗漏，
                也方便我们把下一步动作自动推进到日程与投递流程。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
              <p className="bauhaus-label text-white/70">Gmail</p>
              <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">{isGmail ? "Linked" : "Pending"}</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
              <p className="bauhaus-label text-black/60">IMAP</p>
              <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">{isImap ? "Linked" : "Pending"}</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
              <p className="bauhaus-label text-white/70">Parsed</p>
              <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">{notifications?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="bauhaus-panel-sm flex items-start gap-3 bg-[#F0C020] p-4 text-black">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p className="text-sm font-medium leading-relaxed text-black/78">
          本功能仅供个人学习和求职使用，请勿用于商业抓取或批量数据采集。使用前请确认已阅读平台条款和邮件服务规则。
        </p>
      </motion.section>

      <motion.section variants={item} className="flex flex-wrap gap-2">
        <Button
          startContent={<Link2 size={16} />}
          onPress={handleAuth}
          className={`bauhaus-button !px-4 !py-3 !text-[11px] ${
            isGmail ? "bauhaus-button-yellow" : "bauhaus-button-outline"
          }`}
        >
          {isGmail ? "Gmail 已连" : "授权 Gmail"}
        </Button>
        <Button
          startContent={<Inbox size={16} />}
          onPress={onOpen}
          className={`bauhaus-button !px-4 !py-3 !text-[11px] ${
            isImap ? "bauhaus-button-blue" : "bauhaus-button-outline"
          }`}
        >
          {isImap ? `IMAP 已连 (${emailStatus?.imap_host})` : "IMAP 直连"}
        </Button>
        <Button
          startContent={<RefreshCw size={16} className={syncing ? "animate-spin" : ""} />}
          onPress={handleSync}
          isLoading={syncing}
          isDisabled={!isConnected}
          className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
        >
          同步邮件
        </Button>
        <Button
          startContent={<CalendarPlus size={16} />}
          onPress={handleAutoFill}
          className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]"
        >
          补建日历
        </Button>
      </motion.section>

      <motion.section variants={item}>
        <Card className="bauhaus-panel rounded-none bg-white shadow-none">
          <CardBody className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
            <div className="bauhaus-panel-sm flex h-12 w-12 items-center justify-center bg-[#1040C0] text-white">
              <Mail size={22} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-black uppercase tracking-[-0.04em] text-black">邮箱状态</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-black/65">
                {isConnected
                  ? `${isImap ? `IMAP: ${emailStatus?.imap_user}` : ""}${isImap && isGmail ? " + " : ""}${isGmail ? "Gmail OAuth" : ""} · 已解析 ${notifications?.length ?? 0} 条通知`
                  : "尚未连接邮箱。支持 QQ邮箱 / 163邮箱 / Gmail IMAP 直连，也支持 Gmail OAuth。"}
              </p>
              {syncResult && <p className="mt-2 text-sm font-medium text-[#1040C0]">{syncResult}</p>}
            </div>
            <Chip
              variant="flat"
              className={`border-2 border-black font-semibold ${
                isConnected ? "bg-[#F0C020] text-black" : "bg-white text-black"
              }`}
            >
              {isConnected ? "已连接" : "未连接"}
            </Chip>
          </CardBody>
        </Card>
      </motion.section>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent className={bauhausModalContentClassName}>
          {(onClose) => (
            <>
              <ModalHeader className="border-b-2 border-black bg-[#1040C0] px-6 py-5 text-xl font-black tracking-[-0.06em] text-white">
                <div className="flex items-center gap-2">
                  <Shield size={20} />
                  IMAP 邮箱直连
                </div>
              </ModalHeader>
              <ModalBody className="space-y-4 px-6 py-6">
                <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-sm font-medium leading-relaxed text-black/78">
                  QQ邮箱 / 163邮箱需要使用授权码而不是登录密码。输入完成后会先做连接校验，再保存到本地配置。
                </div>
                <Select
                  label="邮箱服务商"
                  selectedKeys={[imapProvider]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setImapProvider(value);
                  }}
                  classNames={bauhausSelectClassNames}
                >
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.key}>{provider.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="邮箱地址"
                  placeholder="your@qq.com"
                  value={imapUser}
                  onValueChange={setImapUser}
                  classNames={bauhausFieldClassNames}
                />
                <Input
                  label="授权码 / 应用密码"
                  type="password"
                  placeholder="QQ邮箱→设置→账户→生成授权码"
                  value={imapPassword}
                  onValueChange={setImapPassword}
                  classNames={bauhausFieldClassNames}
                />
                {imapError && (
                  <div className="bauhaus-panel-sm flex items-center gap-2 bg-[#D02020] px-4 py-3 text-sm font-medium text-white">
                    <AlertCircle size={14} /> {imapError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="border-t-2 border-black px-6 py-5">
                <Button variant="light" onPress={onClose} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
                  取消
                </Button>
                <Button
                  onPress={() => handleImapConnect(onClose)}
                  isLoading={imapLoading}
                  isDisabled={!imapUser || !imapPassword}
                  className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
                >
                  测试并连接
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <motion.div key={notification.id} variants={item}>
              <Card className="bauhaus-panel rounded-none bg-white shadow-none">
                <CardBody className="space-y-3 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          size="sm"
                          variant="flat"
                          className={CATEGORY_CLASS[notification.category] || CATEGORY_CLASS.unknown}
                        >
                          {notification.category_display || notification.category}
                        </Chip>
                        <h3 className="text-xl font-black tracking-[-0.04em] text-black">
                          {notification.position || notification.email_subject}
                        </h3>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-black/60">
                        {notification.company && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {notification.company}
                          </span>
                        )}
                        {notification.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {notification.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {notification.interview_time && (
                      <Chip size="sm" variant="flat" className="border-2 border-black bg-[#1040C0] font-semibold text-white">
                        <Clock size={12} className="mr-1" />
                        {new Date(notification.interview_time).toLocaleString("zh-CN")}
                      </Chip>
                    )}
                  </div>

                  {notification.action_required && (
                    <div className="bauhaus-panel-sm bg-[#F0C020] px-4 py-3 text-sm font-medium text-black">
                      下一步：{notification.action_required}
                    </div>
                  )}

                  <p className="text-xs font-medium text-black/45">
                    来自: {notification.email_from} · 解析于 {notification.parsed_at}
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card className="bauhaus-panel rounded-none bg-[#1040C0] text-white shadow-none">
            <CardBody className="p-10 text-center">
              <Mail size={54} className="mx-auto" />
              <p className="mt-4 text-2xl font-black uppercase tracking-[-0.05em]">No Notifications Yet</p>
              <p className="mt-3 text-sm font-medium text-white/80">
                先完成邮箱连接，然后同步邮件，这里会出现面试、笔试和 Offer 通知。
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
