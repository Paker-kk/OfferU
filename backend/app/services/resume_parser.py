# =============================================
# 简历文件解析器 — PDF / Word 文本提取
# =============================================
# 支持 .pdf 和 .docx 格式
# 提取纯文本内容，用于 AI 分析或导入到编辑器
# =============================================
# 注意：pypdf / python-docx 都是同步库，
# 使用 asyncio.to_thread 避免阻塞事件循环
# =============================================

import asyncio
import io
from typing import Optional


def _parse_pdf_sync(file_bytes: bytes) -> str:
    """同步：从 PDF 文件提取纯文本"""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            texts.append(text.strip())
    return "\n\n".join(texts)


def _parse_docx_sync(file_bytes: bytes) -> str:
    """同步：从 Word (.docx) 文件提取纯文本"""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    texts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            texts.append(text)
    # 也提取表格中的文本（简历常用表格布局）
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                texts.append(" | ".join(cells))
    return "\n".join(texts)


async def parse_resume_file(filename: str, file_bytes: bytes) -> Optional[str]:
    """
    根据文件扩展名自动选择解析器
    使用 asyncio.to_thread 将同步 IO 卸载到线程池，不阻塞事件循环

    返回: 提取的纯文本，格式不支持返回 None
    """
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return await asyncio.to_thread(_parse_pdf_sync, file_bytes)
    elif lower.endswith(".docx"):
        return await asyncio.to_thread(_parse_docx_sync, file_bytes)
    return None
