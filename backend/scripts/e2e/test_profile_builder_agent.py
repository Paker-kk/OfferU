from __future__ import annotations

import asyncio
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.profile_builder_agent import (  # noqa: E402
    build_initial_agent_state,
    guard_profile_agent_patch,
    normalize_profile_agent_patch,
    run_profile_agent_loop,
)


def test_initial_state_tracks_resume_goal_and_missing_fields() -> None:
    resume_text = """
    张三
    电话：13800138000
    邮箱：zhangsan@example.com
    求职意向：高级产品经理

    工作经历
    星河科技 产品经理 2021.07-2024.03
    负责增长实验平台，推动注册转化率提升 18%。
    """

    state = build_initial_agent_state(
        resume_text=resume_text,
        target_role="AI 产品经理",
        target_city="深圳",
        job_goal="希望找社招 AI 产品方向",
        extracted_base_info={"name": "张三", "phone": "13800138000"},
        resume_candidates=[
            {
                "section_type": "experience",
                "title": "星河科技 产品经理",
                "content_json": {
                    "company": "星河科技",
                    "position": "产品经理",
                    "description": "推动注册转化率提升 18%",
                },
                "confidence": 0.8,
            }
        ],
    )

    assert state["goal"]["target_role"] == "AI 产品经理"
    assert state["goal"]["target_city"] == "深圳"
    assert state["base_info"]["name"] == "张三"
    assert state["resume_text_length"] > 20
    assert state["draft_sections"][0]["section_type"] == "experience"
    assert "impact_metrics" not in state["missing_fields"]
    assert "target_role" not in state["missing_fields"]


def test_patch_normalization_rejects_bad_actions_and_canonicalizes_sections() -> None:
    raw_patch = {
        "action": "propose_patch",
        "assistant_message": "我先整理出一条工作经历，请确认。",
        "base_info": {"email": "zhangsan@example.com"},
        "target_roles": ["AI 产品经理", "增长产品经理"],
        "sections": [
            {
                "section_type": "internship",
                "title": "星河科技 产品经理",
                "content_json": {
                    "company": "星河科技",
                    "position": "产品经理",
                    "description": "推动注册转化率提升 18%",
                },
                "confidence": 1.2,
            }
        ],
        "next_question": "这个转化率提升是怎么验证的？",
    }

    patch = normalize_profile_agent_patch(raw_patch)

    assert patch["action"] == "propose_patch"
    assert patch["base_info"]["email"] == "zhangsan@example.com"
    assert patch["target_roles"] == ["AI 产品经理", "增长产品经理"]
    assert patch["sections"][0]["section_type"] == "experience"
    assert patch["sections"][0]["confidence"] == 1.0
    assert patch["sections"][0]["content_json"]["normalized"]["company"] == "星河科技"
    assert patch["next_question"].endswith("？")


def test_agent_guardrail_converts_auto_apply_to_user_confirmation() -> None:
    state = build_initial_agent_state(
        resume_text="负责增长实验平台，推动注册转化率提升 18%。",
        target_role="AI 产品经理",
        target_city="深圳",
        extracted_base_info={},
        resume_candidates=[],
    )

    decision = guard_profile_agent_patch(
        {
            "action": "apply_patch",
            "assistant_message": "我直接写入档案。",
            "sections": [
                {
                    "section_type": "experience",
                    "title": "增长实验平台",
                    "content_json": {"description": "推动注册转化率提升 18%"},
                    "confidence": 0.8,
                }
            ],
        },
        state=state,
        user_message="负责增长实验平台，推动注册转化率提升 18%。",
    )

    assert decision["patch"]["action"] == "propose_patch"
    assert decision["stop_reason"] == "needs_user_confirmation"
    assert "blocked_auto_apply" in decision["guardrails"]


def test_agent_guardrail_defers_resume_generation_until_profile_is_ready() -> None:
    state = build_initial_agent_state(
        resume_text="",
        target_role="",
        target_city="",
        extracted_base_info={},
        resume_candidates=[],
    )

    decision = guard_profile_agent_patch(
        {
            "action": "generate_resume",
            "assistant_message": "我来生成投递简历。",
        },
        state=state,
        user_message="帮我生成投递简历",
    )

    assert decision["patch"]["action"] == "ask_user"
    assert "target_role" in state["missing_fields"]
    assert decision["patch"]["next_question"]
    assert "deferred_resume_generation" in decision["guardrails"]


def test_agent_loop_records_observe_reason_guard_steps() -> None:
    async def fake_generate_patch(state, messages_json, user_message):  # noqa: ANN001
        assert state["goal"]["target_role"] == "AI 产品经理"
        assert messages_json[-1]["content"] == "负责增长实验平台，推动注册转化率提升 18%。"
        return {
            "action": "apply_patch",
            "assistant_message": "我直接写入档案。",
            "sections": [
                {
                    "section_type": "experience",
                    "title": "增长实验平台",
                    "content_json": {"description": user_message},
                    "confidence": 0.8,
                }
            ],
        }

    state = build_initial_agent_state(
        resume_text="",
        target_role="AI 产品经理",
        target_city="深圳",
        extracted_base_info={},
        resume_candidates=[],
    )

    result = asyncio.run(
        run_profile_agent_loop(
            state=state,
            messages_json=[{"role": "user", "content": "负责增长实验平台，推动注册转化率提升 18%。"}],
            user_message="负责增长实验平台，推动注册转化率提升 18%。",
            generate_patch=fake_generate_patch,
        )
    )

    assert result["patch"]["action"] == "propose_patch"
    assert result["stop_reason"] == "needs_user_confirmation"
    assert result["trace"][0]["phase"] == "observe"
    assert result["trace"][1]["phase"] == "reason"
    assert result["trace"][2]["phase"] == "guard"
    assert "blocked_auto_apply" in result["trace"][2]["guardrails"]


if __name__ == "__main__":
    test_initial_state_tracks_resume_goal_and_missing_fields()
    test_patch_normalization_rejects_bad_actions_and_canonicalizes_sections()
    test_agent_guardrail_converts_auto_apply_to_user_confirmation()
    test_agent_guardrail_defers_resume_generation_until_profile_is_ready()
    test_agent_loop_records_observe_reason_guard_steps()
    print("profile builder agent tests passed")
