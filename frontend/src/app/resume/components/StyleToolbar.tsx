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

  /** 通用工具栏按钮样式 — Bauhaus 小按钮 */
  const toolBtnClass = "h-10 min-w-10 gap-1 rounded-none border-2 border-black bg-white px-2 text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-all hover:-translate-y-[1px] data-[open=true]:bg-[#F0C020]";

  const popoverClassName = "w-56 rounded-none border-2 border-black bg-[#F0F0F0] p-3 text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]";

  /** 面板内 label + value 行 */
  const PropertyRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-black/55">{label}</span>
      <span className="font-mono tabular-nums text-[11px] text-black/45">{value}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-0.5">
      {/* ---- 主色调 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <div
              className="h-3 w-3 rounded-none border border-black"
              style={{ backgroundColor: val("primaryColor") }}
            />
            <Palette size={11} className="text-black/60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverClassName}>
          <p className="mb-2.5 text-[11px] font-black tracking-[0.06em] text-black/60">主色调</p>
          {/* 预设色块网格 — 3x3 布局 */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {COLOR_PRESETS.map((p) => (
              <Tooltip key={p.value} content={p.label} delay={400} closeDelay={0}>
                <button
                  className={`w-full aspect-square rounded-lg transition-all ${
                    val("primaryColor") === p.value
                      ? "scale-105 border-2 border-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]"
                      : "border-2 border-black hover:-translate-y-[1px]"
                  }`}
                  style={{ backgroundColor: p.value }}
                  onClick={() => update("primaryColor", p.value)}
                />
              </Tooltip>
            ))}
          </div>
          {/* 自定义取色器 */}
          <div className="flex items-center gap-2 border-t border-black/10 pt-2">
            <input
              type="color"
              value={val("primaryColor")}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            />
            <span className="text-[10px] font-mono uppercase text-black/45">{val("primaryColor")}</span>
          </div>
        </PopoverContent>
      </Popover>

      <div className="mx-0.5 h-6 w-px bg-black/15" />

      {/* ---- 字号 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <Type size={12} className="text-black/60" />
            <span className="font-mono tabular-nums text-[10px] text-black/55">{val("bodySize")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverClassName}>
          <p className="mb-3 text-[11px] font-black tracking-[0.06em] text-black/60">字号</p>
          <div className="space-y-3">
            <div>
              <PropertyRow label="正文" value={`${val("bodySize")}pt`} />
              <Slider
                size="sm" step={0.5} minValue={8} maxValue={14}
                value={parseFloat(val("bodySize"))}
                onChange={(v) => update("bodySize", String(v))}
                classNames={{ track: "bg-black/10", filler: "bg-[#1040C0]" }}
              />
            </div>
            <div>
              <PropertyRow label="标题" value={`${val("headingSize")}pt`} />
              <Slider
                size="sm" step={0.5} minValue={10} maxValue={18}
                value={parseFloat(val("headingSize"))}
                onChange={(v) => update("headingSize", String(v))}
                classNames={{ track: "bg-black/10", filler: "bg-[#1040C0]" }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ---- 行高/段落间距 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <AlignVerticalSpaceAround size={12} className="text-black/60" />
            <span className="font-mono tabular-nums text-[10px] text-black/55">{val("lineHeight")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverClassName}>
          <p className="mb-3 text-[11px] font-black tracking-[0.06em] text-black/60">间距</p>
          <div className="space-y-3">
            <div>
              <PropertyRow label="行高" value={val("lineHeight")} />
              <Slider
                size="sm" step={0.1} minValue={1.0} maxValue={2.0}
                value={parseFloat(val("lineHeight"))}
                onChange={(v) => update("lineHeight", String(v))}
                classNames={{ track: "bg-black/10", filler: "bg-[#D02020]" }}
              />
            </div>
            <div>
              <PropertyRow label="段落间距" value={`${val("sectionGap")}pt`} />
              <Slider
                size="sm" step={1} minValue={6} maxValue={24}
                value={parseInt(val("sectionGap"))}
                onChange={(v) => update("sectionGap", String(v))}
                classNames={{ track: "bg-black/10", filler: "bg-[#D02020]" }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ---- 页边距 ---- */}
      <Popover placement="bottom">
        <PopoverTrigger>
          <Button variant="light" size="sm" className={toolBtnClass}>
            <Maximize2 size={12} className="text-black/60" />
            <span className="font-mono tabular-nums text-[10px] text-black/55">{val("pageMargin")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverClassName}>
          <p className="mb-3 text-[11px] font-black tracking-[0.06em] text-black/60">页边距</p>
          <PropertyRow label="边距" value={`${val("pageMargin")}cm`} />
          <Slider
            size="sm" step={0.1} minValue={1.0} maxValue={3.0}
            value={parseFloat(val("pageMargin"))}
            onChange={(v) => update("pageMargin", String(v))}
            classNames={{ track: "bg-black/10", filler: "bg-[#1040C0]" }}
          />
        </PopoverContent>
      </Popover>

      <div className="mx-0.5 h-6 w-px bg-black/15" />

      {/* ---- 智能合并一页 — 特殊强调色 ---- */}
      {onFitOnePage && (
        <Tooltip content="自动缩减参数使内容适配一页" delay={600} closeDelay={0}>
          <Button
            variant="light"
            size="sm"
            className="h-10 gap-1 rounded-none border-2 border-black bg-[#F0C020] px-3 text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-all hover:-translate-y-[1px]"
            onPress={onFitOnePage}
            isLoading={fitting}
          >
            <Shrink size={12} />
            <span className="text-[10px] font-semibold tracking-[0.06em]">适配一页</span>
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
