# =============================================
# BOSS直聘 数据源适配器 — 国内主流招聘平台
# =============================================
# 爬取策略：通过 BOSS直聘 公开 API / 网页接口获取搜索结果
# 注意事项：
#   - BOSS直聘 有严格反爬机制（加密 cookie / 滑块验证）
#   - 本适配器提供骨架结构，实际接入需配合：
#     a) 自建代理池 + 浏览器指纹
#     b) 或对接第三方数据服务（如 Apify Actor）
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


class BossScraper(JobScraperBase):
    """
    BOSS直聘适配器
    source_name: "boss"

    当前实现为骨架 — search() 演示了 API 调用结构，
    实际请求需配置 cookie / 加密参数后才能正常工作。
    """

    source_name = "boss"

    # BOSS直聘搜索 API（公开可观察到的端点，仅供结构参考）
    SEARCH_URL = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"

    # 城市码映射（常用）
    CITY_CODES = {
        "北京": "101010100",
        "上海": "101020100",
        "深圳": "101280600",
        "广州": "101280100",
        "杭州": "101210100",
        "成都": "101270100",
        "南京": "101190100",
        "武汉": "101200100",
    }

    def _city_code(self, location: str) -> str:
        return self.CITY_CODES.get(location, "101010100")

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
        搜索 BOSS直聘岗位
        注意：真实调用需要浏览器 cookie 和加密参数，
        这里展示数据映射逻辑，实际使用需补充鉴权。
        """
        results: list[JobItem] = []
        city = self._city_code(location)

        async with httpx.AsyncClient(timeout=15.0) as client:
            for kw in keywords:
                params = {
                    "query": kw,
                    "city": city,
                    "page": 1,
                    "pageSize": min(max_results, 30),
                }
                try:
                    resp = await client.get(
                        self.SEARCH_URL,
                        params=params,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                            "Referer": "https://www.zhipin.com/",
                        },
                    )
                    data = resp.json()

                    # BOSS直聘返回结构：{ zpData: { jobList: [...] } }
                    job_list = (
                        data.get("zpData", {}).get("jobList", [])
                        if data.get("code") == 0
                        else []
                    )

                    for raw in job_list:
                        item = self._normalize(raw)
                        results.append(item)
                        if len(results) >= max_results:
                            break
                except Exception:
                    # 网络异常 / 反爬拦截 → 静默跳过，不影响其他平台
                    continue

                if len(results) >= max_results:
                    break

        return results[:max_results]

    def _normalize(self, raw: dict) -> JobItem:
        """将 BOSS直聘原始 JSON 转为统一 JobItem"""
        enc_id = raw.get("encryptJobId", "")
        lid = raw.get("lid", "")
        url = f"https://www.zhipin.com/job_detail/{enc_id}.html?lid={lid}"

        return JobItem(
            title=raw.get("jobName", ""),
            company=raw.get("brandName", ""),
            location=raw.get("cityName", ""),
            url=url,
            source="boss",
            salary=raw.get("salaryDesc", ""),
            seniority_level=raw.get("jobExperience", ""),
            employment_type=raw.get("jobDegree", ""),
            raw_description="",  # 详情需二次请求
            posted_at="",
            hash_key=self._make_hash(
                raw.get("jobName", ""),
                raw.get("brandName", ""),
                url,
            ),
            company_info={
                "size": raw.get("brandScaleName", ""),
                "industry": raw.get("brandIndustry", ""),
                "stage": raw.get("brandStageName", ""),
            },
        )

    async def get_detail(self, job_id: str) -> Optional[JobItem]:
        """
        获取单个岗位详情页（含完整 JD）
        TODO: 需配合 cookie / 加密参数
        """
        return None


# 注册到全局适配器注册表
register_scraper(BossScraper())
