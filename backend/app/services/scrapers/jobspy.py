# =============================================
# JobSpy 聚合适配器 — LinkedIn / Indeed / Glassdoor / Google
# =============================================
# 基于 python-jobspy 库，一次调用覆盖多个国际招聘平台
# 特点：
#   - 聚合 LinkedIn / Indeed / Glassdoor / ZipRecruiter / Google
#   - 统一的 DataFrame 输出，自动转为 JobItem
#   - 支持按国家、地区、岗位类型筛选
#   - Indeed 是最稳定的源，LinkedIn 需要代理
# =============================================

from __future__ import annotations

import asyncio
import hashlib
from typing import Optional

from app.services.scrapers.base import (
    JobScraperBase,
    JobItem,
    register_scraper,
)


class JobSpyScraper(JobScraperBase):
    """
    JobSpy 聚合适配器
    source_name: "jobspy"

    内部使用 python-jobspy 的 scrape_jobs() 函数
    在线程池中执行（因为 jobspy 是同步库）
    """

    source_name = "jobspy"

    # 默认使用的子平台
    DEFAULT_SITES = ["indeed", "linkedin", "google"]

    async def search(
        self,
        keywords: list[str],
        location: str = "China",
        max_results: int = 50,
    ) -> list[JobItem]:
        """
        通过 python-jobspy 聚合搜索多平台岗位
        jobspy 是同步库，用 asyncio.to_thread 包装
        """
        search_term = " ".join(keywords)

        # 在线程池中执行同步的 jobspy 调用
        items = await asyncio.to_thread(
            self._search_sync,
            search_term=search_term,
            location=location,
            max_results=max_results,
        )
        return items[:max_results]

    def _search_sync(
        self,
        search_term: str,
        location: str,
        max_results: int,
    ) -> list[JobItem]:
        """同步执行 jobspy 搜索"""
        try:
            from jobspy import scrape_jobs
        except ImportError:
            return []

        try:
            # 确定国家参数（Indeed/Glassdoor 需要）
            country = self._detect_country(location)

            df = scrape_jobs(
                site_name=self.DEFAULT_SITES,
                search_term=search_term,
                location=location,
                results_wanted=max_results,
                hours_old=168,  # 最近 7 天
                country_indeed=country,
                description_format="markdown",
                verbose=0,
            )

            if df is None or df.empty:
                return []

            results: list[JobItem] = []
            for _, row in df.iterrows():
                item = self._row_to_item(row)
                if item:
                    results.append(item)

            return results
        except Exception:
            return []

    def _row_to_item(self, row) -> Optional[JobItem]:
        """将 jobspy DataFrame 行转为统一 JobItem"""
        title = str(row.get("title", "") or "").strip()
        company = str(row.get("company", "") or "").strip()
        job_url = str(row.get("job_url", "") or "").strip()

        if not title or not job_url:
            return None

        # 薪资
        min_amt = row.get("min_amount")
        max_amt = row.get("max_amount")
        interval = str(row.get("interval", "") or "")
        salary = ""
        if min_amt and max_amt:
            salary = f"{int(min_amt)}-{int(max_amt)}/{interval}" if interval else f"{int(min_amt)}-{int(max_amt)}"
        elif min_amt:
            salary = f"{int(min_amt)}+/{interval}" if interval else f"{int(min_amt)}+"

        # 地点
        city = str(row.get("city", "") or "").strip()
        state = str(row.get("state", "") or "").strip()
        location_str = f"{city}, {state}" if city and state else city or state

        # 来源平台
        site = str(row.get("site", "") or "").lower()

        # hash
        hash_key = hashlib.md5(f"{title}|{company}|{job_url}".encode()).hexdigest()

        return JobItem(
            title=title,
            company=company,
            location=location_str,
            url=job_url,
            apply_url=job_url,
            source=f"jobspy-{site}" if site else "jobspy",
            raw_description=str(row.get("description", "") or ""),
            posted_at=str(row.get("date_posted", "") or ""),
            seniority_level=str(row.get("job_level", "") or ""),
            employment_type=str(row.get("job_type", "") or ""),
            industries=str(row.get("company_industry", "") or ""),
            salary=salary,
            hash_key=hash_key,
            company_info={
                "url": str(row.get("company_url", "") or ""),
                "logo": str(row.get("company_logo", "") or ""),
                "is_remote": bool(row.get("is_remote", False)),
            },
        )

    @staticmethod
    def _detect_country(location: str) -> str:
        """根据 location 猜测国家参数"""
        loc_lower = location.lower()
        mapping = {
            "china": "China",
            "中国": "China",
            "usa": "USA",
            "美国": "USA",
            "uk": "UK",
            "英国": "UK",
            "japan": "Japan",
            "日本": "Japan",
            "singapore": "Singapore",
            "新加坡": "Singapore",
            "hong kong": "Hong Kong",
            "香港": "Hong Kong",
            "canada": "Canada",
            "加拿大": "Canada",
            "australia": "Australia",
            "澳洲": "Australia",
        }
        for key, val in mapping.items():
            if key in loc_lower:
                return val
        return "China"

    async def get_detail(self, job_id: str) -> Optional[JobItem]:
        """jobspy 搜索结果已包含描述，无需二次请求"""
        return None


# 注册到全局适配器注册表
register_scraper(JobSpyScraper())
