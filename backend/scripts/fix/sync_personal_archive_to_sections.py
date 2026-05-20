"""
迁移脚本：将现有 personal_archive 数据同步到 ProfileSection 表

运行方式：
  cd backend
  python -m scripts.fix.sync_personal_archive_to_sections          # 正式执行
  python -m scripts.fix.sync_personal_archive_to_sections --dry-run # 预览模式

逻辑：
  1. 遍历所有 Profile 记录
  2. 从 base_info_json.personal_archive 解析 resumeArchive
  3. 为每条经历创建 ProfileSection 记录（source="archive_sync"）
  4. 已有的 archive_sync 记录会先被清除再重建
"""
import argparse
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import select
from app.database import async_session
from app.models.models import Profile, ProfileSection
from app.routes.profile import _sync_personal_archive_to_sections


async def main(dry_run: bool = False):
    async with async_session() as db:
        result = await db.execute(select(Profile))
        profiles = list(result.scalars().all())

        mode_label = "预览" if dry_run else "正式"
        print(f"[{mode_label}模式] 找到 {len(profiles)} 个档案记录")

        total_created = 0
        total_failed = 0
        for profile in profiles:
            base_info = profile.base_info_json or {}
            personal_archive = base_info.get("personal_archive")
            if not isinstance(personal_archive, dict):
                print(f"  Profile #{profile.id} ({profile.name}): 无 personal_archive，跳过")
                continue
            if personal_archive.get("schemaVersion") != "personal.archive.v1":
                print(f"  Profile #{profile.id} ({profile.name}): schemaVersion 不匹配，跳过")
                continue

            try:
                count = await _sync_personal_archive_to_sections(profile, db)
                total_created += count
                print(f"  Profile #{profile.id} ({profile.name}): 同步了 {count} 条 ProfileSection")
            except Exception as e:
                total_failed += 1
                print(f"  Profile #{profile.id} ({profile.name}): 同步失败 - {e}")
                continue

        if dry_run:
            await db.rollback()
            print(f"\n[预览模式] 将创建 {total_created} 条 ProfileSection 记录（已回滚，未实际写入）")
            if total_failed:
                print(f"[预览模式] {total_failed} 个档案同步失败")
        else:
            await db.commit()
            print(f"\n迁移完成！共创建 {total_created} 条 ProfileSection 记录")
            if total_failed:
                print(f"警告：{total_failed} 个档案同步失败")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="同步 personal_archive 到 ProfileSection 表")
    parser.add_argument("--dry-run", action="store_true", help="预览模式，不实际写入数据库")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
