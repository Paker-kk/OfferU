// =============================================
// StyleToolbar — Figma 风格顶部样式属性栏
// =============================================
// 设计理念：
//   紧凑图标按钮组 → 点击展开精致的属性面板
//   交互参考 Figma 右侧属性面板 + Canva 顶部工具栏
//   每个按钮仅展示图标 + 最关键的数值预览，hover 显示 tooltip
//   面板内使用 Slider + 数值输入的双模式控制
// =============================================
// 用法：
//   <StyleToolbar config={styleConfig} onChange={setStyleConfig} />
// =============================================

"use client";

import { Slider, Popover, PopoverTrigger, PopoverContent, Button, Tooltip } from "@nextui-org/react";
import {
  Palette, Type, AlignVerticalSpaceAround,
  Maximize2, Shrink,
} from "lucide-react";

/** 默认样式，与 ResumePreview / 后端 DEFAULT_STYLE 一致 */
export const DEFAULT_STYLE_CONFIG: Record<string, string> = {
  primaryColor: "#222222",
  accentColor: "#666666",
  bodySize: "10",
  headingSize: "12",
  lineHeight: "1.5",
  pageMargin: "2",
  sectionGap: "14",
};

/** 样式参数的最小值（智能排版下限） */
export const MIN_STYLE_CONFIG: Record<string, number> = {
  bodySize: 8,
  headingSize: 10,
  lineHeight: 1.0,
  pageMargin: 1.0,
  sectionGap: 6,
};

/**
 * 颜色预设 — 覆盖商务/学术/创意/科技多种场景
 * 分两行展示：上行冷色调，下行暖色调
 */
const COLOR_PRESETS = [
  { label: "经典黑", value: "#222222" },
  { label: "深蓝", value: "#1e3a5f" },
  { label: "靛蓝", value: "#2d3561" },
  { label: "墨绿", value: "#1a4a3a" },
  { label: "青色", value: "#1a5c6b" },
  { label: "酒红", value: "#6b1d2a" },
  { label: "深棕", value: "#4a3728" },
  { label: "紫色", value: "#4a2d6b" },
  { label: "钢灰", value: "#3a3f47" },
];

interface StyleToolbarProps {
  config: Record<string, string>;
  onChange: (config: Record<string, string>) => void;
  /** 点击"合并一页"按钮时触发，由父组件实现测量+缩放逻辑 */
  onFitOnePage?: () => void;
  /** 正在执行合并一页 */
  fitting?: boolean;
}

/**
 * Figma 风格属性工具栏
 * ─────────────────────────────────────────────
 * 布局：[色调按钮] | [字号按钮] | [间距按钮] | [边距按钮] || [合并一页]
 * 每个按钮为 28px 高的圆角方块，紧凑排列
 * Popover 面板统一使用深色毛玻璃背景 + 精致分组
 */
export default function StyleToolbar({ config, onChange, onFitOnePage, fitting }: StyleToolbarProps) {
  const update = (key: string, value: string) => {
    onChange({ ...config, [key]: value });
  };
  const val = (key: string) => config[key] || DEFAULT_STYLE_CONFIG[key];

  /** 通用工具栏按钮样式 — 28px 高，圆角，微透明底色 */
  const toolBtnClass = "h-7 min-w-7 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] rounded-lg gap-1 transition-all data-[open=true]:bg-white/[0.1] data-[open=true]:border-white/[0.15]";

  /** 面板内 label + value 行 */
  const PropertyRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-[11px] text-white/50 font-medium">{label}</span>
      <span className="text-[11px] text-white/35 font-mono tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-0.5">
      {/* ---- 主色调 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <div
              className="w-3 h-3 rounded-[3px] ring-1 ring-white/20 ring-offset-1 ring-offset-transparent"
              style={{ backgroundColor: val("primaryColor") }}
            />
            <Palette size={11} className="text-white/30" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 bg-[#1e1e24]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl w-56 shadow-2xl">
          <p className="text-[11px] font-semibold text-white/40 mb-2.5 uppercase tracking-wider">主色调</p>
          {/* 预设色块网格 — 3x3 布局 */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {COLOR_PRESETS.map((p) => (
              <Tooltip key={p.value} content={p.label} delay={400} closeDelay={0}>
                <button
                  className={`w-full aspect-square rounded-lg transition-all ${
                    val("primaryColor") === p.value
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1e24] scale-105"
                      : "ring-1 ring-white/10 hover:ring-white/30 hover:scale-105"
                  }`}
                  style={{ backgroundColor: p.value }}
                  onClick={() => update("primaryColor", p.value)}
                />
              </Tooltip>
            ))}
          </div>
          {/* 自定义取色器 */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <input
              type="color"
              value={val("primaryColor")}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            />
            <span className="text-[10px] text-white/30 font-mono uppercase">{val("primaryColor")}</span>
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-white/[0.06] mx-0.5" />

      {/* ---- 字号 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <Type size={12} className="text-white/45" />
            <span className="text-[10px] text-white/40 font-mono tabular-nums">{val("bodySize")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 bg-[#1e1e24]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl w-56 shadow-2xl">
          <p className="text-[11px] font-semibold text-white/40 mb-3 uppercase tracking-wider">字号</p>
          <div className="space-y-3">
            <div>
              <PropertyRow label="正文" value={`${val("bodySize")}pt`} />
              <Slider
                size="sm" step={0.5} minValue={8} maxValue={14}
                value={parseFloat(val("bodySize"))}
                onChange={(v) => update("bodySize", String(v))}
                classNames={{ track: "bg-white/[0.06]", filler: "bg-blue-500/60" }}
              />
            </div>
            <div>
              <PropertyRow label="标题" value={`${val("headingSize")}pt`} />
              <Slider
                size="sm" step={0.5} minValue={10} maxValue={18}
                value={parseFloat(val("headingSize"))}
                onChange={(v) => update("headingSize", String(v))}
                classNames={{ track: "bg-white/[0.06]", filler: "bg-blue-500/60" }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ---- 行高/段落间距 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <AlignVerticalSpaceAround size={12} className="text-white/45" />
            <span className="text-[10px] text-white/40 font-mono tabular-nums">{val("lineHeight")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 bg-[#1e1e24]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl w-56 shadow-2xl">
          <p className="text-[11px] font-semibold text-white/40 mb-3 uppercase tracking-wider">间距</p>
          <div className="space-y-3">
            <div>
              <PropertyRow label="行高" value={val("lineHeight")} />
              <Slider
                size="sm" step={0.1} minValue={1.0} maxValue={2.0}
                value={parseFloat(val("lineHeight"))}
                onChange={(v) => update("lineHeight", String(v))}
                classNames={{ track: "bg-white/[0.06]", filler: "bg-blue-500/60" }}
              />
            </div>
            <div>
              <PropertyRow label="段落间距" value={`${val("sectionGap")}pt`} />
              <Slider
                size="sm" step={1} minValue={6} maxValue={24}
                value={parseInt(val("sectionGap"))}
                onChange={(v) => update("sectionGap", String(v))}
                classNames={{ track: "bg-white/[0.06]", filler: "bg-blue-500/60" }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ---- 页边距 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <Maximize2 size={12} className="text-white/45" />
            <span className="text-[10px] text-white/40 font-mono tabular-nums">{val("pageMargin")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 bg-[#1e1e24]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl w-56 shadow-2xl">
          <p className="text-[11px] font-semibold text-white/40 mb-3 uppercase tracking-wider">页边距</p>
          <PropertyRow label="边距" value={`${val("pageMargin")}cm`} />
          <Slider
            size="sm" step={0.1} minValue={1.0} maxValue={3.0}
            value={parseFloat(val("pageMargin"))}
            onChange={(v) => update("pageMargin", String(v))}
            classNames={{ track: "bg-white/[0.06]", filler: "bg-blue-500/60" }}
          />
        </PopoverContent>
      </Popover>

      <div className="w-px h-4 bg-white/[0.06] mx-0.5" />

      {/* ---- 智能合并一页 — 特殊强调色 ---- */}
      {onFitOnePage && (
        <Tooltip content="自动缩减参数使内容适配一页" delay={600} closeDelay={0}>
          <Button
            variant="light"
            size="sm"
            className="h-7 px-2 bg-blue-500/[0.08] hover:bg-blue-500/[0.15] border border-blue-500/[0.15] hover:border-blue-500/[0.25] rounded-lg gap-1 text-blue-400/80 hover:text-blue-400 transition-all"
            onPress={onFitOnePage}
            isLoading={fitting}
          >
            <Shrink size={12} />
            <span className="text-[10px] font-medium">适配一页</span>
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
