// =============================================
// 爬虫控制台 — 数据源管理 + 任务监控
// =============================================
// 功能：数据源卡片、关键词/城市配置、一键爬取、任务历史
// =============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Spinner,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import {
  Globe,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  MapPin,
  Loader2,
  Key,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  useScraperSources,
  useScraperTasks,
  runScraper,
  useBossStatus,
  saveBossCookie,
} from "@/lib/hooks";

const statusConfig: Record<string, { color: "success" | "warning" | "default" | "danger"; label: string }> = {
  ready: { color: "success", label: "就绪" },
  skeleton: { color: "warning", label: "骨架" },
  planned: { color: "default", label: "计划中" },
  unsupported: { color: "danger", label: "不支持" },
};

export default function ScraperPage() {
  const router = useRouter();
  const { data: sources, isLoading: sourcesLoading } = useScraperSources();
  const { data: tasks, mutate: refreshTasks } = useScraperTasks();
  const { data: bossStatus, mutate: refreshBoss } = useBossStatus();
  const { isOpen: isBossOpen, onOpen: onBossOpen, onClose: onBossClose } = useDisclosure();
  const [keywords, setKeywords] = useState("校招");
  const [location, setLocation] = useState("");
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bossCookie, setBossCookie] = useState("");
  const [bossSaving, setBossSaving] = useState(false);
  const [bossError, setBossError] = useState<string | null>(null);

  const handleRun = async (sourceKey: string) => {
    // BOSS直聘需要先配置 Cookie
    if (sourceKey === "boss" && !bossStatus?.configured) {
      onBossOpen();
      return;
    }
    setError(null);
    setRunningSource(sourceKey);
    try {
      const kws = keywords
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const runResult = await runScraper(sourceKey, kws, location);
      refreshTasks();
      if (runResult?.pool_id) {
        const qs = new URLSearchParams({
          tab: "inbox",
          pool_id: String(runResult.pool_id),
          from_scraper: "1",
        });
        if (runResult?.task_id) {
          qs.set("task_id", String(runResult.task_id));
        }
        router.push(`/jobs?${qs.toString()}`);
      } else {
        router.push("/jobs?tab=inbox");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunningSource(null);
    }
  };

  const handleSaveBossCookie = async () => {
    if (!bossCookie.trim()) return;
    setBossSaving(true);
    setBossError(null);
    try {
      if (!bossCookie.includes("wt2")) {
        setBossError("Cookie 中未找到 wt2 字段，请确认已登录 BOSS直聘后完整复制");
        setBossSaving(false);
        return;
      }
      await saveBossCookie(bossCookie.trim());
      refreshBoss();
      setBossCookie("");
      onBossClose();
    } catch (e: any) {
      setBossError(e.message || "保存失败");
    } finally {
      setBossSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold">爬虫控制台</h1>
        <p className="text-white/50 mt-1">管理数据源、配置关键词、监控爬取任务</p>
      </div>

      {/* 免责声明 */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 text-orange-300/80 text-xs leading-relaxed">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          本功能仅供个人学习和求职使用，请勿用于商业抓取或批量数据采集。使用前请确认已阅读各平台服务条款和 robots.txt 规定，因使用本工具产生的任何法律风险由用户自行承担。
        </span>
      </div>

      {/* 全局配置 */}
      <Card className="bg-white/5 border border-white/10">
        <CardBody className="p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search size={18} /> 爬取配置
          </h2>
          <div className="flex flex-wrap gap-4">
            <Input
              label="搜索关键词"
              placeholder="多个关键词用逗号分隔，如：校招,前端,Python"
              value={keywords}
              onValueChange={setKeywords}
              classNames={{
                base: "max-w-sm",
                inputWrapper: "bg-white/5 border border-white/10",
              }}
              size="sm"
            />
            <Input
              label="城市"
              placeholder="如：北京、上海、全国"
              value={location}
              onValueChange={setLocation}
              startContent={<MapPin size={14} className="text-white/40" />}
              classNames={{
                base: "max-w-xs",
                inputWrapper: "bg-white/5 border border-white/10",
              }}
              size="sm"
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-1">
              <XCircle size={14} /> {error}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 数据源卡片 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">数据源</h2>
        {sourcesLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sources?.map((src) => {
              const cfg = statusConfig[src.status] || statusConfig.planned;
              const isRunning = runningSource === src.key;
              return (
                <motion.div
                  key={src.key}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="bg-white/5 border border-white/10">
                    <CardHeader className="flex items-center justify-between px-5 pt-4 pb-0">
                      <div className="flex items-center gap-2">
                        <Globe size={18} className="text-blue-400" />
                        <span className="font-semibold">{src.name}</span>
                      </div>
                      <Chip size="sm" variant="flat" color={cfg.color}>
                        {cfg.label}
                      </Chip>
                    </CardHeader>
                    <CardBody className="px-5 pb-4 space-y-3">
                      <p className="text-sm text-white/50">{src.description}</p>
                      {/* BOSS直聘数据源显示 Cookie 配置状态 */}
                      {src.key === "boss" && (
                        <div className="flex items-center gap-2">
                          {bossStatus?.configured ? (
                            <Chip size="sm" variant="flat" color="success" startContent={<Key size={10} />}>
                              Cookie 已配置
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat" color="warning" startContent={<AlertTriangle size={10} />}>
                              需配置 Cookie
                            </Chip>
                          )}
                          <Button
                            size="sm"
                            variant="light"
                            color="primary"
                            onPress={onBossOpen}
                            className="text-xs h-6 min-w-0 px-2"
                          >
                            {bossStatus?.configured ? "更新 Cookie" : "配置 Cookie"}
                          </Button>
                        </div>
                      )}
                      <Button
                        size="sm"
                        color="primary"
                        variant={src.status === "ready" ? "solid" : "flat"}
                        isDisabled={src.status !== "ready" || isRunning}
                        isLoading={isRunning}
                        startContent={!isRunning && <Play size={14} />}
                        onPress={() => handleRun(src.key)}
                      >
                        {src.status === "ready"
                          ? "开始爬取"
                          : src.status === "unsupported"
                          ? "不支持"
                          : src.status === "skeleton"
                          ? "开发中"
                          : "待开发"}
                      </Button>
                    </CardBody>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 任务历史 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">任务记录</h2>
        {!tasks || tasks.length === 0 ? (
          <Card className="bg-white/5 border border-white/10">
            <CardBody className="p-6 text-center text-white/40">
              暂无爬取记录，选择一个数据源开始爬取
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <Card key={task.id} className="bg-white/5 border border-white/10">
                <CardBody className="p-4 flex flex-row items-center gap-4">
                  {/* 状态图标 */}
                  {task.status === "running" ? (
                    <Loader2 size={18} className="text-blue-400 animate-spin" />
                  ) : task.status === "completed" ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <XCircle size={18} className="text-red-400" />
                  )}

                  {/* 任务信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.source}</span>
                      <span className="text-xs text-white/40">
                        {task.keywords.join(", ")}
                      </span>
                      {task.location && (
                        <span className="text-xs text-white/40">
                          · {task.location}
                        </span>
                      )}
                    </div>
                    {task.result && (
                      <p className="text-xs text-white/50 mt-0.5">
                        {task.result.error
                          ? `错误: ${task.result.error}`
                          : (task.result as Record<string, unknown>).warning
                          ? `⚠️ ${(task.result as Record<string, unknown>).warning}`
                          : `新增 ${task.result.created} 个 / 跳过 ${task.result.skipped} 个 / 共 ${task.result.total} 个`}
                      </p>
                    )}
                  </div>

                  {/* 时间 */}
                  <div className="flex items-center gap-1 text-xs text-white/40 shrink-0">
                    <Clock size={12} />
                    {new Date(task.created_at).toLocaleString("zh-CN")}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== BOSS直聘 Cookie 配置引导弹窗 ===== */}
      <Modal
        isOpen={isBossOpen}
        onClose={onBossClose}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-[#1a1a2e] border border-white/10",
          header: "border-b border-white/10",
          footer: "border-t border-white/10",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Key size={18} className="text-blue-400" />
            配置 BOSS直聘 Cookie
          </ModalHeader>
          <ModalBody className="space-y-4 py-4">
            {/* 免责声明 */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-sm text-yellow-200/80">
                  <p className="font-semibold mb-1">免责声明</p>
                  <p>此功能通过您提供的 Cookie 访问 BOSS直聘 API，可能违反其用户协议。
                  Cookie 仅存储在本地，不会上传至任何第三方。使用此功能即表示您自行承担相关风险。</p>
                </div>
              </div>
            </div>

            {/* 分步引导 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-1">
                <Info size={14} className="text-blue-400" /> 获取 Cookie 步骤
              </h3>
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex gap-3 items-start">
                  <span className="bg-blue-500/20 text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                  <span>
                    在浏览器中打开{" "}
                    <a href="https://www.zhipin.com" target="_blank" rel="noopener noreferrer"
                       className="text-blue-400 hover:underline inline-flex items-center gap-0.5">
                      zhipin.com <ExternalLink size={10} />
                    </a>
                    ，确保已登录账号
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="bg-blue-500/20 text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                  <span>按 <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">F12</kbd> 打开开发者工具，切换到 <strong>Network（网络）</strong> 标签页</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="bg-blue-500/20 text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                  <span>在 BOSS直聘页面随意搜索一个职位，Network 中会出现请求</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="bg-blue-500/20 text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">4</span>
                  <span>点击任意一个请求 → <strong>Headers（标头）</strong> → 找到 <strong>Cookie</strong> 字段 → 右键复制完整值</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="bg-blue-500/20 text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">5</span>
                  <span>粘贴到下方文本框中</span>
                </div>
              </div>

              {/* 提示：Firefox 兼容 */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-xs text-blue-200/70">
                💡 提示：Chrome/Edge 打开 DevTools 后 BOSS直聘页面可能闪退，建议使用 <strong>Firefox</strong> 浏览器操作。
              </div>
            </div>

            {/* Cookie 输入 */}
            <Textarea
              label="BOSS直聘 Cookie"
              placeholder="粘贴完整的 Cookie 字符串（应包含 wt2=... 和 zp_token=... 等字段）"
              value={bossCookie}
              onValueChange={setBossCookie}
              minRows={4}
              maxRows={8}
              classNames={{
                inputWrapper: "bg-white/5 border border-white/10",
              }}
            />

            {/* Cookie 校验提示 */}
            {bossCookie && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Chip size="sm" variant="flat"
                  color={bossCookie.includes("wt2") ? "success" : "danger"}>
                  wt2: {bossCookie.includes("wt2") ? "✓ 找到" : "✗ 缺失"}
                </Chip>
                <Chip size="sm" variant="flat"
                  color={bossCookie.includes("zp_token") ? "success" : "warning"}>
                  zp_token: {bossCookie.includes("zp_token") ? "✓ 找到" : "⚠ 缺失"}
                </Chip>
              </div>
            )}

            {bossError && (
              <div className="text-red-400 text-sm flex items-center gap-1">
                <XCircle size={14} /> {bossError}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onBossClose}>取消</Button>
            <Button
              color="primary"
              onPress={handleSaveBossCookie}
              isLoading={bossSaving}
              isDisabled={!bossCookie.trim()}
            >
              保存 Cookie
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
