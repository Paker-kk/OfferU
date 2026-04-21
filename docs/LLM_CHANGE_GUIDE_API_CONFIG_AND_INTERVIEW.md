# LLM Change Guide — LLM Configuration Transparency and Interview Flow Fix

## Purpose

This document is an implementation guide for an LLM or engineer working on a small, high-confidence repair in OfferU. The goal is to fix confusing API-key behavior and repair a real bug in the AI interview answer flow, without introducing unrelated refactors.

## Scope

This guide only covers:

1. Making the effective LLM configuration explicit and predictable.
2. Ensuring user-selected third-party OpenAI-compatible API keys can drive the main AI flows.
3. Fixing the interview answer generation bug caused by reading the wrong profile field.

This guide does **not** cover:

- a full secret-management redesign,
- a full settings UX redesign,
- a full AI Interview product implementation,
- a full Resume Editor redesign,
- broad architectural refactoring.

---

## Problem Summary

### Problem A — Hidden LLM credential fallback

The application may continue working even when the user believes no API key is configured. This happens because runtime LLM calls can reuse locally persisted configuration from `backend/config.json`, or fall back to legacy per-provider key fields.

This creates low-trust behavior:

- the user does not know which provider is actually active,
- the user may think a new third-party provider is active while the app is still using an older saved config,
- debugging becomes difficult because the system appears to succeed for unclear reasons.

### Problem B — AI interview answer flow reads the wrong field

The interview answer route builds profile context using `ProfileSection.content`, but `ProfileSection` stores structured content in `content_json`.

As a result, `/api/interview/generate-answer` likely fails or generates empty context.

---

## Relevant Files

### LLM configuration
- `backend/app/agents/llm.py`
- `backend/app/routes/config.py`
- `frontend/src/app/settings/page.tsx`

### Interview answer flow
- `backend/app/routes/interview.py`
- `backend/app/models/models.py`

### Core AI features already using the shared LLM layer
- `backend/app/routes/profile.py`
- `backend/app/routes/optimize.py`
- `backend/app/routes/agent.py`
- `backend/app/agents/interview_prep.py`
- `backend/app/agents/cover_letter.py`
- `backend/app/agents/email_parser.py`

---

## Current Findings

### Config loading behavior

`backend/app/routes/config.py` loads local config from `backend/config.json` first, normalizes it, then syncs it into runtime settings.

This means a previously saved key can remain active even when the user no longer expects it.

### LLM resolution behavior

`backend/app/agents/llm.py` currently:

1. reads `llm_provider`, `llm_model`, `active_llm_base_url`, `active_llm_api_key`,
2. falls back to provider-specific legacy keys if `active_llm_api_key` is empty,
3. proceeds as long as some key exists.

This is too permissive for a settings-driven product.

### Interview answer behavior

`backend/app/routes/interview.py` reads `s.content`, but `ProfileSection` has `content_json`, not `content`.

This is a real implementation bug, not a product ambiguity.

---

## Goals

### Primary goals

1. Make the effective LLM config visible and understandable.
2. Make active-config behavior consistent for third-party API keys.
3. Fix interview answer generation so it can read profile content correctly.

### Secondary goal

4. Prepare a stable foundation for the next phase: AI Interview UI skeleton and Resume Editor skeleton.

---

## Implementation Plan

## Part 1 — Tighten LLM config resolution

### File
`backend/app/agents/llm.py`

### Target behavior

For non-Ollama providers, use this precedence:

1. If active-config state exists (`active_llm_config_id` or `active_llm_base_url` or `active_llm_api_key`), use **only** the active config.
2. Only if no active-config state exists at all, allow fallback to legacy per-provider key fields.
3. If the selected non-Ollama config is incomplete, fail clearly with a configuration error.

### Why

This removes hidden success caused by stale local or legacy credentials.

### Guidance

In `_get_client()`:

- Introduce a small boolean such as `has_active_selection`.
- If `provider == "ollama"`, keep the current Ollama-specific flow.
- If `has_active_selection` is true:
  - use `active_llm_api_key` and `active_llm_base_url` only,
  - do not silently fall back to legacy provider keys,
  - raise a clear error if required values are missing.
- If `has_active_selection` is false:
  - preserve legacy fallback behavior for backward compatibility.

### Constraints

- Do not redesign the tier model system.
- Do not add new abstraction layers unless strictly necessary.
- Keep changes local to `_get_client()`.

---

## Part 2 — Expose effective config summary

### File
`backend/app/routes/config.py`

### Target behavior

The config response should include a small read-only summary of the currently effective LLM setup.

### Suggested response field

```json
{
  "active_llm_summary": {
    "provider_id": "qwen",
    "service_name": "Qwen",
    "model": "qwen3.5-plus",
    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "source": "active_config"
  }
}
```

### Allowed source values

- `active_config`
- `legacy_env`
- `ollama`

### Guidance

Implement this in `_response_payload()`.

Do not over-engineer it. A small helper is acceptable, but a direct inline summary is also fine.

### Why

The frontend needs a trustworthy explanation of what the app is actually using.

---

## Part 3 — Show effective config in settings UI

### File
`frontend/src/app/settings/page.tsx`

### Target behavior

The settings page should show a read-only block near the API configuration section with:

- active provider,
- active model,
- active base URL,
- source type.

### Guidance

- Use existing config response data.
- Add a compact information block above or below the API config table.
- Do not redesign the full settings layout.
- This is a clarity fix, not a visual overhaul.

### Why

This directly solves the user confusion: “Why is the app still working when I thought no API key was configured?”

---

## Part 4 — Fix interview profile extraction bug

### File
`backend/app/routes/interview.py`

### Target behavior

Replace the broken profile bullet aggregation logic so that profile context is derived from `ProfileSection.content_json`.

### Minimal extraction priority

For each `ProfileSection`, extract text in this order:

1. `content_json["bullet"]`
2. `content_json["description"]`
3. `title`

If none exist, skip the section.

### Guidance

- Add a tiny local helper inside `interview.py`.
- Do not create a new shared utility unless required by multiple modified call sites.
- Build the final `profile_bullets` string from available text only.

### Why

This is the smallest reliable fix and keeps the change surgical.

---

## Expected Functional Outcome

After implementation:

1. Users can see which LLM config is actually in effect.
2. A selected third-party OpenAI-compatible config can drive the major AI flows consistently.
3. The app no longer silently succeeds because of unclear hidden fallback when active config state exists.
4. Interview answer generation can read real stored profile data again.

---

## Acceptance Criteria

### Config transparency
- The settings page visibly shows the effective provider, model, base URL, and source type.
- The backend config endpoint returns this summary reliably.

### Config behavior
- When a third-party provider config is marked active and saved, core AI features use it.
- If the active config is incomplete, the user receives a clear error instead of a hidden fallback success.

### Interview behavior
- `/api/interview/generate-answer` no longer references a non-existent `content` field.
- The endpoint can generate answer hints using profile content from `content_json`.

---

## Smoke Test Checklist

### Test 1 — Active config visibility
1. Open settings.
2. Save a third-party or custom OpenAI-compatible config.
3. Mark it active.
4. Refresh the page.
5. Confirm the effective-config summary matches the saved config.

### Test 2 — Profile chat
Trigger the profile chat flow and confirm:
- it uses the active provider,
- it fails clearly if the active config is invalid.

### Test 3 — Resume optimization
Trigger the optimize/rewrite flow and confirm:
- it still works,
- it uses the active provider.

### Test 4 — Agent chat
Trigger the agent chat flow and confirm:
- it still works,
- it uses the active provider.

### Test 5 — Interview extract / answer
Trigger interview extraction and answer generation and confirm:
- extraction still works,
- answer generation no longer fails because of missing `content`,
- answer generation receives real profile context.

---

## Known Risk

This work will likely expose setups that accidentally depended on stale local config. That is acceptable and desirable, because the current hidden behavior is part of the problem.

---

## Follow-up Phase

After this fix is complete and verified, the next product/design phase should define:

1. the AI Interview workspace skeleton,
2. the Resume Editor workspace skeleton,
3. a more human, less “AI product” interaction style.

That next phase should focus on information architecture and workflow design, not on expanding backend abstractions.
