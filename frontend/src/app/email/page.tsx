// =============================================
// 邮件通知页 — 面试邮件自动解析
// =============================================
// Gmail OAuth 授权 + 邮件同步 + AI 解析结果展示
// 授权流程：获取 auth_url → 跳转 Google → 回调后自动连接
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardBody, Button, Chip } from "@nextui-org/react";
import { Mail, RefreshCw, Link2, Building2, MapPin, Clock } from "lucide-react";
import { useNotifications, useEmailStatus, syncEmails, getEmailAuthUrl } from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function EmailPage() {
  const { data: notifications, mutate } = useNotifications();
  const { data: emailStatus, mutate: mutateStatus } = useEmailStatus();
  const [syncing, setSyncing] = useState(false);

  /** Gmail OAuth 授权 — 获取链接并跳转 */
  const handleAuth = async () => {
    const res = await getEmailAuthUrl();
    if (res.auth_url) {
      window.location.href = res.auth_url;
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncEmails();
    await mutate();
    await mutateStatus();
    setSyncing(false);
  };

  const isConnected = emailStatus?.connected ?? false;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">邮件面试通知</h1>
        <div className="flex gap-2">
          <Button
            startContent={<Link2 size={16} />}
            variant="flat"
            size="sm"
            color={isConnected ? "success" : "default"}
            onPress={handleAuth}
          >
            {isConnected ? "已授权" : "授权Gmail"}
          </Button>
          <Button
            startContent={<RefreshCw size={16} className={syncing ? "animate-spin" : ""} />}
            color="primary"
            size="sm"
            onPress={handleSync}
            isLoading={syncing}
          >
            同步邮件
          </Button>
        </div>
      </motion.div>

      {/* 通知状态 */}
      <motion.div variants={item}>
        <Card className="bg-white/5 border border-white/10">
          <CardBody className="flex flex-row items-center gap-4 p-4">
            <Mail className="text-blue-400" size={24} />
            <div>
              <p className="font-medium">邮箱状态</p>
              <p className="text-sm text-white/50">
                {isConnected
                  ? `已连接 Gmail · 已解析 ${notifications?.length ?? 0} 条面试通知`
                  : "尚未授权邮箱，请点击「授权Gmail」完成 OAuth 授权"}
              </p>
            </div>
            <Chip
              color={isConnected ? "success" : "warning"}
              variant="flat"
              size="sm"
              className="ml-auto"
            >
              {isConnected ? "已连接" : "未连接"}
            </Chip>
          </CardBody>
        </Card>
      </motion.div>

      {/* 通知列表 */}
      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <motion.div key={n.id} variants={item}>
              <Card className="bg-white/5 border border-white/10">
                <CardBody className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-blue-300">
                      {n.position || n.email_subject}
                    </h3>
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
              <p className="text-sm">授权邮箱后，面试通知将在此自动展示</p>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
