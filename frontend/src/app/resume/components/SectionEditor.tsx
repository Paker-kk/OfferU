// =============================================
// SectionEditor 鈥?娈佃惤缂栬緫鍣紙鎸?section_type 娓叉煋涓嶅悓琛ㄥ崟锛?
// =============================================
// 閫氱敤鍧楄璁★細education / experience / skill / project / certificate / custom
// 缁撴瀯鍖栧瓧娈碉紙瀛︽牎鍚嶃€佸叕鍙稿悕锛変娇鐢?Input 组件
// 鎻忚堪绫诲瓧娈典娇鐢?RichTextEditor锛圱ipTap锛?
// 鏀寔娈佃惤鍐呮潯鐩殑澧炲垹
// =============================================
// 瑙嗚璁捐锛?
//   条目卡片：微透明底色 + 鏋佺粏杈规锛屽眰娆℃劅閫氳繃鐏板害鍖哄垎
//   琛ㄥ崟杈撳叆锛氱粺涓€ inputStyle 绫诲悕閰嶇疆锛堜笌缂栬緫鍣ㄤ富闈㈡澘涓€致）
//   间距：space-y-2.5 淇濇寔绱у噾浣嗕笉鎷ユ尋
// =============================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Button, Textarea } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

/** 缁熶竴鐨?Input classNames 鈥?Bauhaus 娴呰壊纭竟椋庢牸 */
const inputStyle = {
  inputWrapper:
    "border border-black/15 bg-[var(--surface)] shadow-[1px_1px_0_0_rgba(18,18,18,0.08)] group-data-[focus=true]:border-black/35",
  input: "font-medium text-black placeholder:text-black/45",
  label: "font-semibold tracking-[0.06em] text-[11px] text-black/65",
  description: "text-black/55",
  errorMessage: "font-medium text-[#D02020]",
};

interface SectionEditorProps {
  sectionType: string;
  contentJson: any[];
  onChange: (newContent: any[]) => void;
}

export function createEmptySectionItem(sectionType: string) {
  const templates: Record<string, any> = {
    education: { school: "", degree: "", major: "", gpa: "", startDate: "", endDate: "", description: "" },
    experience: { company: "", position: "", startDate: "", endDate: "", description: "" },
    skill: { _entryType: "skill", category: "", items: [] },
    project: { name: "", role: "", url: "", startDate: "", endDate: "", description: "" },
    certificate: { name: "", scoreOrLevel: "", issuer: "", date: "", url: "" },
    custom: { subtitle: "", description: "" },
  };
  return templates[sectionType] || { subtitle: "", description: "" };
}

export function createEmptySkillEntry() {
  return { _entryType: "skill", category: "", items: [] };
}

export function createEmptyCertificateEntry() {
  return { _entryType: "certificate", name: "", scoreOrLevel: "", issuer: "", date: "", url: "" };
}

/**
 * 閫氱敤娈佃惤缂栬緫鍣?
 * 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * 根据 sectionType 娓叉煋瀵瑰簲鐨勮〃鍗曠粨鏋勩€?
 * contentJson 鏄竴涓暟缁勶紝姣忎釜鍏冪礌鏄娈佃惤涓殑涓€涓潯鐩€?
 * onChange 鍥炶皟浼犲洖鏇存柊鍚庣殑瀹屾暣鏁扮粍銆?
 */
export default function SectionEditor({
  sectionType,
  contentJson,
  onChange,
}: SectionEditorProps) {
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set());

  const getSkillEntryType = (item: any): "skill" | "certificate" => {
    if (item?._entryType === "certificate") return "certificate";
    if (item?._entryType === "skill") return "skill";
    if (item?.name || item?.issuer || item?.date || item?.scoreOrLevel) return "certificate";
    return "skill";
  };

  const getItemTitle = (item: any, index: number) => {
    if (sectionType === "education") return item.school || `教育条目 ${index + 1}`;
    if (sectionType === "experience") return item.company || item.position || `经历条目 ${index + 1}`;
    if (sectionType === "project") return item.name || `项目条目 ${index + 1}`;
    if (sectionType === "skill") {
      return getSkillEntryType(item) === "certificate"
        ? item.name || `证书条目 ${index + 1}`
        : item.category || `技能条目 ${index + 1}`;
    }
    if (sectionType === "certificate") return item.name || `证书条目 ${index + 1}`;
    return item.subtitle || `条目 ${index + 1}`;
  };

  useEffect(() => {
    // 鏉＄洰鏁伴噺鍙樺寲鍚庯紝鑷姩娓呯悊瓒婄晫鎶樺彔绱㈠紩
    setCollapsedItems((prev) => {
      const next = new Set<number>();
      for (const index of prev) {
        if (index >= 0 && index < contentJson.length) {
          next.add(index);
        }
      }
      return next;
    });
  }, [contentJson.length]);

  const itemCount = useMemo(() => contentJson.length, [contentJson.length]);

  const toggleItem = (index: number) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  /** 鏇存柊鏁扮粍涓煇涓潯鐩殑鏌愪釜瀛楁 */
  const updateItem = (index: number, field: string, value: any) => {
    const arr = [...contentJson];
    arr[index] = { ...arr[index], [field]: value };
    onChange(arr);
  };

  /** 娣诲姞鏂版潯鐩紙鎸夌被鍨嬬敓鎴愮┖妯℃澘锛?*/
  const addItem = () => {
    onChange([...contentJson, createEmptySectionItem(sectionType)]);
  };

  const addSkillItem = () => {
    onChange([...contentJson, createEmptySkillEntry()]);
  };

  const addCertificateItem = () => {
    onChange([...contentJson, createEmptyCertificateEntry()]);
  };

  /** 删除条目 */
  const removeItem = (index: number) => {
    onChange(contentJson.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2.5">
      {contentJson.map((item, i) => (
        <div
          key={i}
          className="bauhaus-panel-sm space-y-2.5 bg-[#F0F0F0] p-3"
          data-testid={`resume-item-${sectionType}-${i}`}
        >
          {/* 鏉＄洰澶撮儴锛氬簭鍙?+ 删除 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical size={12} className="cursor-grab text-black/30" />
              <span className="font-mono text-[10px] text-black/35">#{i + 1}</span>
              <span className="max-w-[160px] truncate text-[11px] font-semibold tracking-[0.04em] text-black/60">
                {getItemTitle(item, i)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="light"
                className="bauhaus-button bauhaus-button-outline !h-8 !px-3 !py-2 !text-[10px]"
                onPress={() => toggleItem(i)}
                data-testid={`resume-item-toggle-${sectionType}-${i}`}
              >
                {collapsedItems.has(i) ? (
                  <span className="flex items-center gap-1"><ChevronDown size={11} />展开</span>
                ) : (
                  <span className="flex items-center gap-1"><ChevronUp size={11} />折叠</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={() => removeItem(i)}
                aria-label="删除条目"
                data-testid={`resume-item-delete-${sectionType}-${i}`}
                className="bauhaus-button bauhaus-button-red !h-8 !min-w-8 !w-8 !px-0 !py-0"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {!collapsedItems.has(i) && (
              <motion.div
                key={`${sectionType}-${i}-body`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden space-y-2.5"
              >
                {/* 鎸夌被鍨嬫覆鏌撳瓧娈?*/}
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
                      <label className="mb-1 block text-xs font-semibold tracking-[0.06em] text-black/55">描述</label>
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
                      <label className="mb-1 block text-xs font-semibold tracking-[0.06em] text-black/55">工作描述</label>
                      <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="描述你的工作职责和成果..." />
                    </div>
                  </>
                )}

                {sectionType === "skill" && (
                  <>
                    {getSkillEntryType(item) === "certificate" ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="证书名称" variant="bordered" size="sm" value={item.name || ""} onValueChange={(v) => updateItem(i, "name", v)} classNames={inputStyle} />
                          <Input label="等级/分数" variant="bordered" size="sm" value={item.scoreOrLevel || ""} onValueChange={(v) => updateItem(i, "scoreOrLevel", v)} classNames={inputStyle} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="颁发机构" variant="bordered" size="sm" value={item.issuer || ""} onValueChange={(v) => updateItem(i, "issuer", v)} classNames={inputStyle} />
                          <Input label="获得日期" variant="bordered" size="sm" value={item.date || ""} onValueChange={(v) => updateItem(i, "date", v)} classNames={inputStyle} />
                        </div>
                        <Input label="证书链接（可选）" variant="bordered" size="sm" value={item.url || ""} onValueChange={(v) => updateItem(i, "url", v)} placeholder="https://..." classNames={inputStyle} />
                      </>
                    ) : (
                      <>
                        <Input
                          label="技能分类"
                          variant="bordered"
                          size="sm"
                          value={item.category || ""}
                          onValueChange={(v) => updateItem(i, "category", v)}
                          placeholder="如：编程语言、框架、工具"
                          classNames={inputStyle}
                        />
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
                      <label className="mb-1 block text-xs font-semibold tracking-[0.06em] text-black/55">项目描述</label>
                      <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="描述项目亮点和你的贡献..." />
                    </div>
                  </>
                )}

                {sectionType === "certificate" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="证书名称" variant="bordered" size="sm" value={item.name || ""} onValueChange={(v) => updateItem(i, "name", v)} classNames={inputStyle} />
                      <Input label="等级/分数" variant="bordered" size="sm" value={item.scoreOrLevel || ""} onValueChange={(v) => updateItem(i, "scoreOrLevel", v)} classNames={inputStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="颁发机构" variant="bordered" size="sm" value={item.issuer || ""} onValueChange={(v) => updateItem(i, "issuer", v)} classNames={inputStyle} />
                      <Input label="获得日期" variant="bordered" size="sm" value={item.date || ""} onValueChange={(v) => updateItem(i, "date", v)} classNames={inputStyle} />
                    </div>
                    <Input label="证书链接（可选）" variant="bordered" size="sm" value={item.url || ""} onValueChange={(v) => updateItem(i, "url", v)} placeholder="https://..." classNames={inputStyle} />
                  </>
                )}

                {sectionType === "custom" && (
                  <>
                    <Input
                      label="副标题"
                      variant="bordered"
                      size="sm"
                      value={item.subtitle || ""}
                      onValueChange={(v) => updateItem(i, "subtitle", v)}
                      classNames={inputStyle}
                    />
                    <div>
                      <label className="mb-1 block text-xs font-semibold tracking-[0.06em] text-black/55">内容</label>
                      <RichTextEditor content={item.description || ""} onChange={(v) => updateItem(i, "description", v)} placeholder="输入自定义内容..." />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {sectionType === "skill" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            startContent={<Plus size={12} />}
            onPress={addSkillItem}
            data-testid="resume-item-add-skill"
            className="bauhaus-button bauhaus-button-outline !w-full !justify-center !border-dashed !px-4 !py-3 !text-[11px]"
          >
            添加技能条目
          </Button>
          <Button
            size="sm"
            startContent={<Plus size={12} />}
            onPress={addCertificateItem}
            data-testid="resume-item-add-certificate"
            className="bauhaus-button bauhaus-button-outline !w-full !justify-center !border-dashed !px-4 !py-3 !text-[11px]"
          >
            添加证书条目
          </Button>
          <div className="col-span-2 text-center text-[10px] text-black/35">当前共 {itemCount} 条</div>
        </div>
      ) : (
        <Button
          size="sm"
          startContent={<Plus size={12} />}
          onPress={addItem}
          data-testid={`resume-item-add-${sectionType}`}
          className="bauhaus-button bauhaus-button-outline !w-full !justify-center !border-dashed !px-4 !py-3 !text-[11px]"
        >
          添加{sectionType === "education" ? "教育经历" : sectionType === "experience" ? "工作经历" : sectionType === "project" ? "项目" : sectionType === "certificate" ? "证书" : "条目"}
          <span className="ml-2 text-[10px] text-black/35">({itemCount})</span>
        </Button>
      )}
    </div>
  );
}

