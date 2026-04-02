# =============================================
# 智联招聘 数据源适配器
# =============================================
# 爬取策略：通过智联招聘公开搜索 API 获取岗位列表
# 注意事项：
#   - 智联招聘的搜索接口需要携带特定 Header
#   - 本适配器提供完整的数据映射骨架
#   - 实际生产需配合代理池 + 验证码处理
#   - 请遵守 robots.txt 和相关法律法规
# =============================================

import hashlib
from typing import Optional

import httpx

from app.services.scrapers.base import (
    JobScraperBase,
    JobItem,
    register_scraper,
)


class ZhilianScraper(JobScraperBase):
    """
    智联招聘适配器
    source_name: "zhilian"

    搜索流程：
      1. 构造搜索 API 请求（关键词 + 城市码）
      2. 解析返回的 JSON jobList
      3. _normalize() 转为统一 JobItem 格式
    """

    source_name = "zhilian"

    # 智联招聘搜索 API 端点
    SEARCH_URL = "https://fe-api.zhaopin.com/c/i/sou"

    # 城市码映射（智联招聘使用自己的编码体系）
    CITY_CODES = {
        "北京": "530",
        "上海": "538",
        "深圳": "765",
        "广州": "763",
        "杭州": "653",
        "成都": "801",
        "南京": "635",
        "武汉": "736",
        "西安": "854",
        "苏州": "639",
    }

    # 请求头（模拟浏览器访问）
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://sou.zhaopin.com/",
        "Origin": "https://sou.zhaopin.com",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    def _city_code(self, location: str) -> str:
        return self.CITY_CODES.get(location, "530")

    def _make_hash(self, title: str, company: str, url: str) -> str:
        raw = f"{title}|{company}|{url}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def search(
        self,
        keywords: list[str],
        location: str = "北京",
        max_results: int = 50,
    ) -> list[JobItem]:
        """
        搜索智联招聘岗位
        每个关键词发起一次请求，合并结果后截断到 max_results
        """
        results: list[JobItem] = []
        city = self._city_code(location)

        async with httpx.AsyncClient(timeout=15.0) as client:
            for kw in keywords:
                params = {
                    "kw": kw,
                    "cityId": city,
                    "start": 0,
                    "pageSize": min(max_results, 60),
                    "kt": 3,  # 搜索类型
                }
                try:
                    resp = await client.get(
                        self.SEARCH_URL,
                        params=params,
                        headers=self.HEADERS,
                    )
                    data = resp.json()

                    # 智联返回结构：
                    # { code: 200, data: { results: [ ... ], numFound: N } }
                    job_list = data.get("data", {}).get("results", [])

                    for raw in job_list:
                        item = self._normalize(raw)
                        results.append(item)
                        if len(results) >= max_results:
                            break
                except Exception:
                    # 网络异常 / 反爬拦截 → 静默跳过
                    continue

                if len(results) >= max_results:
                    break

        return results[:max_results]

    def _normalize(self, raw: dict) -> JobItem:
        """将智联招聘原始 JSON 转为统一 JobItem"""
        # 岗位详情页 URL
        number = raw.get("number", "")
        url = f"https://jobs.zhaopin.com/{number}.htm" if number else ""

        title = raw.get("jobName", "")
        company = raw.get("company", {}).get("name", "")
        city = raw.get("city", {}).get("display", "")
        salary = raw.get("salary", "")

        return JobItem(
            title=title,
            company=company,
            location=city,
            url=url,
            source="zhilian",
            salary=salary,
            seniority_level=raw.get("workingExp", {}).get("name", ""),
            employment_type=raw.get("eduLevel", {}).get("name", ""),
            raw_description="",  # 智联搜索结果不含完整 JD，需二次请求
            posted_at=raw.get("updateDate", ""),
            hash_key=self._make_hash(title, company, url),
            company_info={
                "size": raw.get("company", {}).get("size", {}).get("name", ""),
                "type": raw.get("company", {}).get("type", {}).get("name", ""),
            },
        )

    async def get_detail(self, job_id: str) -> Optional[JobItem]:
        """
        获取单个岗位详情页（含完整 JD）
        TODO: 请求 https://jobs.zhaopin.com/{job_id}.htm 解析HTML
        """
        return None


# 注册到全局适配器注册表
register_scraper(ZhilianScraper())
