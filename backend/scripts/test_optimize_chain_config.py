from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.routes.optimize import _looks_like_corrupt_placeholder_text  # noqa: E402


def test_optimize_rewrite_uses_standard_tier_for_deepseek_v4_flash() -> None:
    source = (ROOT / "app" / "routes" / "optimize.py").read_text(encoding="utf-8")
    rewrite_block = re.search(r"async def _llm_rewrite_sections[\s\S]+?parsed = extract_json", source)
    assert rewrite_block is not None
    assert 'tier="standard"' in rewrite_block.group(0)
    assert 'tier="premium"' not in rewrite_block.group(0)


def test_optimize_filters_question_mark_placeholder_pollution() -> None:
    assert _looks_like_corrupt_placeholder_text("???? ????")
    assert _looks_like_corrupt_placeholder_text("项目经历 � � �")
    assert not _looks_like_corrupt_placeholder_text("访谈 20 位用户并输出产品建议")


if __name__ == "__main__":
    test_optimize_rewrite_uses_standard_tier_for_deepseek_v4_flash()
    test_optimize_filters_question_mark_placeholder_pollution()
    print("optimize chain config tests passed")
