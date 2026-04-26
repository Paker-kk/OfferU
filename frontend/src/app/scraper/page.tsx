"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Key,
  Loader2,
  MapPin,
  Play,
  Search,
  XCircle,
} from "lucide-react";
import {
  runScraper,
  saveBossCookie,
  useBossStatus,
  useScraperSources,
  useScraperTasks,
} from "@/lib/hooks";
import {
  bauhausFieldClassNames,
  bauhausModalContentClassName,
} from "@/lib/bauhaus";

const statusConfig: Record<
  string,
  {
    label: string;
    chipClass: string;
  }
> = {
  ready: { label: "就绪", chipClass: "border-2 border-black bg-[#1040C0] text-white font-semibold" },
  skeleton: { label: "开发中", chipClass: "border-2 border-black bg-[#F0C020] text-black font-semibold" },
  planned: { label: "计划中", chipClass: "border-2 border-black bg-white text-black font-semibold" },
  unsupported: { label: "不支持", chipClass: "border-2 border-black bg-[#D02020] text-white font-semibold" },
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
    if (sourceKey === "boss" && !bossStatus?.configured) {
      onBossOpen();
      return;
    }
    setError(null);
    setRunningSource(sourceKey);
    try {
      const parsedKeywords = keywords
        .split(/[,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await runScraper(sourceKey, parsedKeywords, location);
      refreshTasks();
      if (result?.pool_id) {
        const query = new URLSearchParams({
          tab: "inbox",
          pool_id: String(result.pool_id),
          from_scraper: "1",
        });
        if (result?.task_id) query.set("task_id", String(result.task_id));
        router.push(`/jobs?${query.toString()}`);
      } else {
        router.push("/jobs?tab=inbox");
      }
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setBossError(err.message || "保存失败");
    } finally {
      setBossSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#F0C020]">Scraper Console</span>
            <div>
              <p className="bauhaus-label text-black/55">Source Control</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Search
                <br />
                Capture
                <br />
                Queue
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                在这里统一配置关键词、城市和数据源，把抓取任务压成清晰的几何工作流，
                方便我们快速判断当前岗位入口是否足够丰富。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
              <p className="bauhaus-label text-white/70">Sources</p>
              <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">{sources?.length ?? 0}</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
              <p className="bauhaus-label text-black/60">Tasks</p>
              <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">{tasks?.length ?? 0}</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
              <p className="bauhaus-label text-white/70">BOSS Cookie</p>
              <p className="mt-3 text-lg font-black uppercase tracking-[-0.05em]">{bossStatus?.configured ? "Ready" : "Required"}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="bauhaus-panel-sm flex items-start gap-3 bg-[#F0C020] p-4 text-black">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span className="text-sm font-medium leading-relaxed text-black/78">
          本功能仅供个人学习和求职使用，请勿用于商业抓取或批量数据采集。使用前请确认已阅读平台服务条款和 robots.txt 规定。
        </span>
      </div>

      <Card className="bauhaus-panel rounded-none bg-white shadow-none">
        <CardBody className="space-y-4 p-5">
          <h2 className="text-2xl font-black uppercase tracking-[-0.05em] text-black">爬取配置</h2>
          <div className="flex flex-wrap gap-4">
            <Input
              label="搜索关键词"
              placeholder="多个关键词用逗号分隔，如：校招,前端,Python"
              value={keywords}
              onValueChange={setKeywords}
              classNames={{
                ...bauhausFieldClassNames,
                base: "max-w-md",
              }}
              size="sm"
            />
            <Input
              label="城市"
              placeholder="如：北京、上海、全国"
              value={location}
              onValueChange={setLocation}
              startContent={<MapPin size={14} className="text-black/45" />}
              classNames={{
                ...bauhausFieldClassNames,
                base: "max-w-xs",
              }}
              size="sm"
            />
          </div>
          {error && (
            <div className="bauhaus-panel-sm flex items-center gap-2 bg-[#D02020] px-4 py-3 text-sm font-medium text-white">
              <XCircle size={14} /> {error}
            </div>
          )}
        </CardBody>
      </Card>

      <section>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-[-0.05em] text-black">数据源</h2>
        {sourcesLoading ? (
          <div className="flex justify-center py-10">
            <div className="bauhaus-panel-sm flex items-center gap-3 bg-white px-5 py-4">
              <Spinner size="sm" color="warning" />
              <span className="text-sm font-semibold tracking-[0.04em] text-black/70">正在载入数据源...</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sources?.map((source) => {
              const status = statusConfig[source.status] || statusConfig.planned;
              const isRunning = runningSource === source.key;
              return (
                <motion.div key={source.key} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                  <Card className="bauhaus-panel h-full rounded-none bg-white shadow-none">
                    <CardHeader className="flex items-center justify-between gap-3 border-b-2 border-black px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bauhaus-panel-sm flex h-10 w-10 items-center justify-center bg-[#1040C0] text-white">
                          <Globe size={18} />
                        </div>
                        <span className="text-lg font-black tracking-[-0.04em] text-black">{source.name}</span>
                      </div>
                      <Chip size="sm" variant="flat" className={status.chipClass}>
                        {status.label}
                      </Chip>
                    </CardHeader>
                    <CardBody className="space-y-4 p-5">
                      <p className="text-sm font-medium leading-relaxed text-black/68">{source.description}</p>

                      {source.key === "boss" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip
                            size="sm"
                            variant="flat"
                            className={`border-2 border-black font-semibold ${
                              bossStatus?.configured ? "bg-[#F0C020] text-black" : "bg-white text-black"
                            }`}
                          >
                            <Key size={10} className="mr-1" />
                            {bossStatus?.configured ? "Cookie 已配置" : "需配置 Cookie"}
                          </Chip>
                          <Button onPress={onBossOpen} className="bauhaus-button bauhaus-button-outline !min-h-8 !px-3 !py-2 !text-[11px]">
                            {bossStatus?.configured ? "更新 Cookie" : "配置 Cookie"}
                          </Button>
                        </div>
                      )}

                      <Button
                        isDisabled={source.status !== "ready" || isRunning}
                        isLoading={isRunning}
                        startContent={!isRunning && <Play size={14} />}
                        onPress={() => handleRun(source.key)}
                        className={`bauhaus-button !px-4 !py-3 !text-[11px] ${
                          source.status === "ready" ? "bauhaus-button-red" : "bauhaus-button-outline opacity-60"
                        }`}
                      >
                        {source.status === "ready"
                          ? "开始爬取"
                          : source.status === "unsupported"
                            ? "不支持"
                            : source.status === "skeleton"
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
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-[-0.05em] text-black">任务记录</h2>
        {!tasks || tasks.length === 0 ? (
          <Card className="bauhaus-panel rounded-none bg-[#1040C0] text-white shadow-none">
            <CardBody className="p-8 text-center">
              <Search size={48} className="mx-auto" />
              <p className="mt-4 text-2xl font-black uppercase tracking-[-0.05em]">No Tasks Yet</p>
              <p className="mt-3 text-sm font-medium text-white/80">选择一个数据源并点击开始爬取，任务记录会出现在这里。</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card key={task.id} className="bauhaus-panel rounded-none bg-white shadow-none">
                <CardBody className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="bauhaus-panel-sm flex h-11 w-11 items-center justify-center bg-[#F0F0F0] text-black">
                      {task.status === "running" ? (
                        <Loader2 size={18} className="animate-spin text-[#1040C0]" />
                      ) : task.status === "completed" ? (
                        <CheckCircle size={18} className="text-[#1040C0]" />
                      ) : (
                        <XCircle size={18} className="text-[#D02020]" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black tracking-[-0.04em] text-black">{task.source}</span>
                        <span className="text-xs font-medium text-black/45">{task.keywords.join(", ")}</span>
                        {task.location && <span className="text-xs font-medium text-black/45">· {task.location}</span>}
                      </div>
                      {task.result && (
                        <p className="mt-2 text-sm font-medium text-black/65">
                          {task.result.error
                            ? `错误: ${task.result.error}`
                            : (task.result as Record<string, unknown>).warning
                              ? `提示: ${(task.result as Record<string, unknown>).warning}`
                              : `新增 ${task.result.created} 个 / 跳过 ${task.result.skipped} 个 / 共 ${task.result.total} 个`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-black/45">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(task.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={isBossOpen} onClose={onBossClose} size="2xl" scrollBehavior="inside">
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="flex items-center gap-2 border-b-2 border-black bg-[#1040C0] px-6 py-5 text-xl font-black tracking-[-0.06em] text-white">
            <Key size={18} />
            配置 BOSS 直聘 Cookie
          </ModalHeader>
          <ModalBody className="space-y-4 px-6 py-6">
            <div className="bauhaus-panel-sm bg-[#F0C020] p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-black" />
                <div className="text-sm font-medium leading-relaxed text-black/78">
                  <p className="mb-1 font-black tracking-[0.04em]">免责声明</p>
                  <p>此功能通过你提供的 Cookie 访问 BOSS直聘接口，可能违反其用户协议。Cookie 仅存储在本地，请自行承担相关风险。</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-black tracking-[0.04em] text-black">获取 Cookie 步骤</h3>
              <div className="space-y-2 text-sm font-medium leading-relaxed text-black/72">
                <div className="flex gap-3"><span className="bauhaus-panel-sm flex h-6 w-6 items-center justify-center bg-[#1040C0] text-xs font-black text-white">1</span><span>打开 <a href="https://www.zhipin.com" target="_blank" rel="noopener noreferrer" className="underline">zhipin.com</a> 并确保已登录。</span></div>
                <div className="flex gap-3"><span className="bauhaus-panel-sm flex h-6 w-6 items-center justify-center bg-[#1040C0] text-xs font-black text-white">2</span><span>按 F12 打开开发者工具，切到 Network 标签页。</span></div>
                <div className="flex gap-3"><span className="bauhaus-panel-sm flex h-6 w-6 items-center justify-center bg-[#1040C0] text-xs font-black text-white">3</span><span>在页面任意搜索一个职位，让请求列表刷新出来。</span></div>
                <div className="flex gap-3"><span className="bauhaus-panel-sm flex h-6 w-6 items-center justify-center bg-[#1040C0] text-xs font-black text-white">4</span><span>点开任一请求，在 Headers 中找到 Cookie 并复制完整值。</span></div>
                <div className="flex gap-3"><span className="bauhaus-panel-sm flex h-6 w-6 items-center justify-center bg-[#1040C0] text-xs font-black text-white">5</span><span>把复制结果粘贴到下面文本框并保存。</span></div>
              </div>
              <div className="bauhaus-panel-sm bg-white px-4 py-3 text-xs font-medium text-black/60">
                提示：如果 Chrome / Edge 的 DevTools 导致页面闪退，可以改用 Firefox 操作。
              </div>
            </div>

            <Textarea
              label="BOSS 直聘 Cookie"
              placeholder="粘贴完整 Cookie 字符串（应包含 wt2=... 和 zp_token=... 等字段）"
              value={bossCookie}
              onValueChange={setBossCookie}
              minRows={4}
              maxRows={8}
              classNames={bauhausFieldClassNames}
            />

            {bossCookie && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Chip
                  size="sm"
                  variant="flat"
                  className={`border-2 border-black font-semibold ${
                    bossCookie.includes("wt2") ? "bg-[#F0C020] text-black" : "bg-[#D02020] text-white"
                  }`}
                >
                  wt2: {bossCookie.includes("wt2") ? "找到" : "缺失"}
                </Chip>
                <Chip
                  size="sm"
                  variant="flat"
                  className={`border-2 border-black font-semibold ${
                    bossCookie.includes("zp_token") ? "bg-[#1040C0] text-white" : "bg-white text-black"
                  }`}
                >
                  zp_token: {bossCookie.includes("zp_token") ? "找到" : "缺失"}
                </Chip>
              </div>
            )}

            {bossError && (
              <div className="bauhaus-panel-sm flex items-center gap-2 bg-[#D02020] px-4 py-3 text-sm font-medium text-white">
                <XCircle size={14} /> {bossError}
              </div>
            )}
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button variant="light" onPress={onBossClose} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
              取消
            </Button>
            <Button
              onPress={handleSaveBossCookie}
              isLoading={bossSaving}
              isDisabled={!bossCookie.trim()}
              className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
            >
              保存 Cookie
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
