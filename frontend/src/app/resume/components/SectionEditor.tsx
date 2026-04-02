// =============================================
// SectionEditor — 段落编辑器（按 section_type 渲染不同表单）
// =============================================
// 通用块设计：education / experience / skill / project / certificate / custom
// 结构化字段（学校名、公司名）使用 Input 组件
// 描述类字段使用 RichTextEditor（TipTap）
// 支持段落内条目的增删
// =============================================
// 视觉设计：
//   条目卡片：微透明底色 + 极细边框，层次感通过灰度区分
//   表单输入：统一 inputStyle 类名配置（与编辑器主面板一致）
//   间距：space-y-2.5 保持紧凑但不拥挤
// =============================================

"use client";

import { Input, Button, Textarea } from "@nextui-org/react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

/** 统一的 Input classNames — 与编辑器主面板保持一致的深色透明风格 */
const inputStyle = {
  inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15 group-data-[focus=true]:border-blue-500/50",
};

interface SectionEditorProps {
  sectionType: string;
  contentJson: any[];
  onChange: (newContent: any[]) => void;
}

/**
 * 通用段落编辑器
 * ─────────────────────────────────────────────
 * 根据 sectionType 渲染对应的表单结构。
 * contentJson 是一个数组，每个元素是该段落中的一个条目。
 * onChange 回调传回更新后的完整数组。
 */
export default function SectionEditor({
  sectionType,
  contentJson,
  onChange,
}: SectionEditorProps) {
  /** 更新数组中某个条目的某个字段 */
  const updateItem = (index: number, field: string, value: any) => {
    const arr = [...contentJson];
    arr[index] = { ...arr[index], [field]: value };
    onChange(arr);
  };

  /** 添加新条目（按类型生成空模板） */
  const addItem = () => {
    const templates: Record<string, any> = {
      education: { school: "", degree: "", major: "", gpa: "", startDate: "", endDate: "", description: "" },
      experience: { company: "", position: "", startDate: "", endDate: "", description: "" },
      skill: { category: "", items: [] },
      project: { name: "", role: "", url: "", startDate: "", endDate: "", description: "" },
      certificate: { name: "", issuer: "", date: "", url: "" },
      custom: { subtitle: "", description: "" },
    };
    onChange([...contentJson, templates[sectionType] || { subtitle: "", description: "" }]);
  };

  /** 删除条目 */
  const removeItem = (index: number) => {
    onChange(contentJson.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2.5">
      {contentJson.map((item, i) => (
        <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-2.5">
          {/* 条目头部：序号 + 删除 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical size={12} className="text-white/20 cursor-grab" />
              <span className="text-[10px] text-white/30 font-mono">#{i + 1}</span>
            </div>
            <Button
              size="sm"
              variant="light"
              isIconOnly
              onPress={() => removeItem(i)}
              className="w-6 h-6 min-w-6 text-red-400/50 hover:text-red-400"
            >
              <Trash2 size={12} />
            </Button>
          </div>

          {/* 按类型渲染字段 */}
          {sectionType === "education" && (
            <>
              <Input label="学校" variant="bordered" size="sm" value={item.school || ""} onValueChange={(v) => updateItem(i, "school", v)} classNames={inputStyle} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="学位" variant="bordered" size="sm" value={item.degree || ""} onValueChange={(v) => updateItem(i, "degree", v)} classNames={inputStyle} />
                <Input label="专业" variant="bordered" size="sm" value={item.major || ""} onValueChange={(v) => updateItem(i, "major", v)} classNames={inputStyle} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input label="起始" variant="bordered" size="sm" value={item.startDate || ""} onValueChange={(v) => updateItem(i, "startDate", v)} classNames={inputStyle} />
                <Input label="结束" variant="bordered" size="sm" value={item.endDate || ""} onValueChange={(v) => updateItem(i, "endDate", v)} classNames={inputStyle} />
                <Input label="GPA" variant="bordered" size="sm" value={item.gpa || ""} onValueChange={(v) => updateItem(i, "gpa", v)} classNames={inputStyle} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">描述</label>
                <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} minHeight={80} placeholder="补充说明（可选）" />
              </div>
            </>
          )}

          {sectionType === "experience" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Input label="公司" variant="bordered" size="sm" value={item.company || ""} onValueChange={(v) => updateItem(i, "company", v)} classNames={inputStyle} />
                <Input label="职位" variant="bordered" size="sm" value={item.position || ""} onValueChange={(v) => updateItem(i, "position", v)} classNames={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="起始" variant="bordered" size="sm" value={item.startDate || ""} onValueChange={(v) => updateItem(i, "startDate", v)} classNames={inputStyle} />
                <Input label="结束" variant="bordered" size="sm" value={item.endDate || ""} onValueChange={(v) => updateItem(i, "endDate", v)} classNames={inputStyle} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">工作描述</label>
                <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="描述你的工作职责和成就..." />
              </div>
            </>
          )}

          {sectionType === "skill" && (
            <>
              <Input label="技能分类" variant="bordered" size="sm" value={item.category || ""} onValueChange={(v) => updateItem(i, "category", v)} placeholder="如：编程语言、框架、工具" classNames={inputStyle} />
              <Textarea
                label="技能列表"
                variant="bordered"
                size="sm"
                classNames={inputStyle}
                value={(item.items || []).join(", ")}
                onValueChange={(v) => updateItem(i, "items", v.split(",").map((s: string) => s.trim()).filter(Boolean))}
                placeholder="Python, React, Docker（逗号分隔）"
                minRows={2}
              />
            </>
          )}

          {sectionType === "project" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Input label="项目名称" variant="bordered" size="sm" value={item.name || ""} onValueChange={(v) => updateItem(i, "name", v)} classNames={inputStyle} />
                <Input label="角色" variant="bordered" size="sm" value={item.role || ""} onValueChange={(v) => updateItem(i, "role", v)} classNames={inputStyle} />
              </div>
              <Input label="项目链接" variant="bordered" size="sm" value={item.url || ""} onValueChange={(v) => updateItem(i, "url", v)} placeholder="https://..." classNames={inputStyle} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="起始" variant="bordered" size="sm" value={item.startDate || ""} onValueChange={(v) => updateItem(i, "startDate", v)} classNames={inputStyle} />
                <Input label="结束" variant="bordered" size="sm" value={item.endDate || ""} onValueChange={(v) => updateItem(i, "endDate", v)} classNames={inputStyle} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">项目描述</label>
                <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="描述项目亮点和你的贡献..." />
              </div>
            </>
          )}

          {sectionType === "certificate" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Input label="证书名称" variant="bordered" size="sm" value={item.name || ""} onValueChange={(v) => updateItem(i, "name", v)} classNames={inputStyle} />
                <Input label="颁发机构" variant="bordered" size="sm" value={item.issuer || ""} onValueChange={(v) => updateItem(i, "issuer", v)} classNames={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="获得日期" variant="bordered" size="sm" value={item.date || ""} onValueChange={(v) => updateItem(i, "date", v)} classNames={inputStyle} />
                <Input label="证书链接" variant="bordered" size="sm" value={item.url || ""} onValueChange={(v) => updateItem(i, "url", v)} placeholder="https://..." classNames={inputStyle} />
              </div>
            </>
          )}

          {sectionType === "custom" && (
            <>
              <Input label="副标题" variant="bordered" size="sm" value={item.subtitle || ""} onValueChange={(v) => updateItem(i, "subtitle", v)} classNames={inputStyle} />
              <div>
                <label className="text-xs text-white/50 mb-1 block">内容</label>
                <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="输入自定义内容..." />
              </div>
            </>
          )}
        </div>
      ))}

      {/* 添加条目按钮 */}
      <Button
        size="sm"
        variant="flat"
        startContent={<Plus size={12} />}
        onPress={addItem}
        className="w-full border border-dashed border-white/[0.08] bg-transparent hover:bg-white/[0.03] text-white/35 hover:text-white/50 h-8 text-xs"
      >
        添加{sectionType === "education" ? "教育经历" : sectionType === "experience" ? "工作经历" : sectionType === "skill" ? "技能分组" : sectionType === "project" ? "项目" : sectionType === "certificate" ? "证书" : "条目"}
      </Button>
    </div>
  );
}
