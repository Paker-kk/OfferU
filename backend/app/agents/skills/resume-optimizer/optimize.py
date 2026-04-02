#!/usr/bin/env python3
"""
Resume Optimizer — 容器内执行脚本
==================================
由 SKILL.md 指导模型调用本脚本，在 OpenAI hosted container 内运行。
读取 /mnt/data/resume.json + /mnt/data/jd.txt，
输出 /mnt/data/result.json（Git-Diff 风格优化建议）。

注意：本脚本在 OpenAI container 内运行（Debian 12 + Python 3.11），
不依赖任何外部包，仅使用标准库。
"""

import json
import re
import sys
from pathlib import Path

DATA_DIR = Path("/mnt/data")


def load_inputs():
    """加载简历 JSON 和 JD 文本"""
    resume_path = DATA_DIR / "resume.json"
    jd_path = DATA_DIR / "jd.txt"

    if not resume_path.exists():
        print("ERROR: resume.json not found", file=sys.stderr)
        sys.exit(1)
    if not jd_path.exists():
        print("ERROR: jd.txt not found", file=sys.stderr)
        sys.exit(1)

    with open(resume_path, "r", encoding="utf-8") as f:
        resume = json.load(f)
    with open(jd_path, "r", encoding="utf-8") as f:
        jd_text = f.read()

    return resume, jd_text


def extract_keywords_from_jd(jd_text: str) -> set:
    """从 JD 文本中提取关键技能词（简单的 NLP 方法）"""
    # 常见技术关键词模式
    tech_patterns = [
        r'\b(?:Python|Java|JavaScript|TypeScript|Go|Rust|C\+\+|C#|Ruby|PHP|Swift|Kotlin)\b',
        r'\b(?:React|Vue|Angular|Next\.js|Node\.js|Django|Flask|FastAPI|Spring|Express)\b',
        r'\b(?:AWS|Azure|GCP|Docker|Kubernetes|K8s|Terraform|CI/CD|Jenkins|GitHub Actions)\b',
        r'\b(?:SQL|MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|Kafka|RabbitMQ)\b',
        r'\b(?:Machine Learning|Deep Learning|NLP|Computer Vision|TensorFlow|PyTorch)\b',
        r'\b(?:REST|GraphQL|gRPC|Microservices|API|OAuth|JWT)\b',
        r'\b(?:Agile|Scrum|Kanban|JIRA|Confluence)\b',
        r'\b(?:Git|Linux|Nginx|Apache|Prometheus|Grafana)\b',
    ]
    keywords = set()
    for pattern in tech_patterns:
        matches = re.findall(pattern, jd_text, re.IGNORECASE)
        keywords.update(m.strip() for m in matches)
    return keywords


def extract_keywords_from_resume(resume: dict) -> set:
    """从简历中提取已有关键词"""
    keywords = set()
    for section in resume.get("sections", []):
        content = section.get("content_json", [])
        for item in content:
            # 技能段落
            if isinstance(item.get("items"), list):
                keywords.update(item["items"])
            # 描述文本
            desc = item.get("description", "")
            if desc:
                # 从 HTML 中提取纯文本关键词
                text = re.sub(r'<[^>]+>', ' ', desc)
                words = re.findall(r'\b[A-Za-z][A-Za-z0-9+#.]*\b', text)
                keywords.update(w for w in words if len(w) > 2)
    return keywords


def calculate_ats_score(jd_keywords: set, resume_keywords: set) -> int:
    """计算 ATS 匹配分数（0-100）"""
    if not jd_keywords:
        return 80  # 无法提取关键词时给默认分
    # 不区分大小写匹配
    jd_lower = {k.lower() for k in jd_keywords}
    resume_lower = {k.lower() for k in resume_keywords}
    matched = jd_lower & resume_lower
    return min(100, int(len(matched) / max(len(jd_lower), 1) * 100))


def find_keyword_gaps(jd_keywords: set, resume_keywords: set) -> list:
    """找出简历中缺失的 JD 关键词"""
    jd_lower = {k.lower(): k for k in jd_keywords}
    resume_lower = {k.lower() for k in resume_keywords}
    gaps = []
    for lower, original in jd_lower.items():
        if lower not in resume_lower:
            gaps.append(original)
    return sorted(gaps)


def generate_suggestions(resume: dict, jd_text: str, jd_keywords: set, gaps: list) -> list:
    """
    生成优化建议列表
    注意：真正的描述润色由 AI 模型在 SKILL.md 指导下完成，
    本脚本主要处理结构化分析（关键词/排序），
    模型会在此基础上进一步增强 suggestions。
    """
    suggestions = []

    # 1. 关键词注入建议 — 找到技能段落并建议补充
    for section in resume.get("sections", []):
        if section.get("section_type") == "skill":
            for i, item in enumerate(section.get("content_json", [])):
                current_items = item.get("items", [])
                current_lower = {k.lower() for k in current_items}
                new_items = [g for g in gaps if g.lower() not in current_lower]
                if new_items:
                    suggestions.append({
                        "type": "keyword_inject",
                        "section_id": section.get("id"),
                        "item_index": i,
                        "field": "items",
                        "original": current_items,
                        "suggested": current_items + new_items[:5],
                        "reason": f"JD 要求以下技能但简历中未提及: {', '.join(new_items[:5])}"
                    })

    # 2. 段落排序建议 — 根据 JD 内容判断最优排序
    sections = resume.get("sections", [])
    if len(sections) > 1:
        # 简单启发式：检查 JD 中哪些类型的内容被最先提到
        type_priority = {}
        jd_lower = jd_text.lower()
        for kw, priority in [("experience", 1), ("skill", 2), ("project", 3),
                              ("education", 4), ("certificate", 5)]:
            pos = jd_lower.find(kw)
            type_priority[kw] = pos if pos >= 0 else 9999

        current_order = [s.get("id") for s in sections]
        sorted_sections = sorted(sections,
                                  key=lambda s: type_priority.get(s.get("section_type", ""), 9999))
        suggested_order = [s.get("id") for s in sorted_sections]

        if current_order != suggested_order:
            suggestions.append({
                "type": "section_reorder",
                "original_order": current_order,
                "suggested_order": suggested_order,
                "reason": "根据 JD 优先级重新排列模块顺序，将最相关的内容放在前面"
            })

    return suggestions


def main():
    """主流程：加载 → 分析 → 输出"""
    resume, jd_text = load_inputs()

    # 提取关键词
    jd_keywords = extract_keywords_from_jd(jd_text)
    resume_keywords = extract_keywords_from_resume(resume)

    # 计算 ATS 分数
    ats_before = calculate_ats_score(jd_keywords, resume_keywords)
    gaps = find_keyword_gaps(jd_keywords, resume_keywords)

    # 生成建议
    suggestions = generate_suggestions(resume, jd_text, jd_keywords, gaps)

    # 预估优化后分数（假设采纳关键词建议）
    ats_after = min(100, ats_before + len(gaps) * 3)

    result = {
        "ats_score": ats_before,
        "ats_score_after": ats_after,
        "keyword_gaps": gaps,
        "suggestions": suggestions,
        "summary": (
            f"当前 ATS 匹配度 {ats_before}%，"
            f"发现 {len(gaps)} 个缺失关键词，"
            f"生成 {len(suggestions)} 条优化建议。"
            f"采纳后预计提升至 {ats_after}%。"
        )
    }

    # 写入结果
    output_path = DATA_DIR / "result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Optimization complete: {len(suggestions)} suggestions generated")
    print(f"ATS score: {ats_before}% → {ats_after}%")
    print(f"Result saved to {output_path}")


if __name__ == "__main__":
    main()
