# PRD — UI Tone-Down While Preserving OfferU's Bauhaus Identity

## 1. Overview

This PRD defines a focused UI/UX refinement pass for OfferU.

The current product already has a distinctive Bauhaus / geometric editorial identity, which should be preserved. The problem is not the direction itself; it is the current **visual density** and **readability cost**. Too many bold elements are stacked together at the same time: hard borders, heavy shadows, saturated color blocking, decorative geometry, dot patterns, uppercase labels with wide tracking, and multiple competing accent colors.

The goal of this PRD is to make the interface feel:
- calmer,
- easier to scan,
- easier to read,
- less visually noisy,
while still feeling recognizably like OfferU.

This is a refinement pass, not a full redesign.

---

## 2. Problem Statement

### Current problems

1. **The UI feels overly busy**
   - Too many decorative shapes and patterns are always visible.
   - Too many components have the same visual intensity.
   - Background decoration competes with content.

2. **The UI is harder to read than it should be**
   - Large all-caps headings and wide letter spacing are overused.
   - Dense pages use the same strong visual treatment as hero sections.
   - Chips, badges, and metadata often compete with titles and actions.

3. **The product tone is drifting from “confident” toward “aggressive”**
   - The current design language is memorable, but repeated heavy shadows, thick borders, and saturated panels across many modules make it feel louder than necessary.

4. **Task-oriented pages are not visually prioritized correctly**
   - Working surfaces such as jobs, profile, settings, and resume management should feel more operational and legible.
   - Brand personality should live mostly in headers, accents, and a few signature moments.

---

## 3. Product Goal

Refine the existing UI so that:

- the product still feels bold and geometric,
- the brand identity remains clearly recognizable,
- the interface becomes more readable and less exhausting,
- dense pages become easier to scan and use,
- the visual system becomes more selective about where emphasis appears.

---

## 4. Success Criteria

The refinement is successful if users can say:

- “It still looks like the same product.”
- “It feels cleaner and more professional.”
- “The pages are easier to read.”
- “Important content stands out more clearly.”
- “The style is still special, but not as overwhelming.”

Operationally, this means:

1. Hero sections still preserve strong geometric identity.
2. Working pages feel calmer than marketing-like surfaces.
3. Secondary information is visually demoted.
4. Decorative background elements no longer compete with content.
5. The strongest shadows and highest-contrast blocks are used selectively, not everywhere.

---

## 5. Design Principles

### Principle 1 — Preserve the design language, reduce the density
Do not replace the Bauhaus direction with generic SaaS minimalism.
Instead, keep the same language but use it more selectively.

### Principle 2 — Hero surfaces can be louder than work surfaces
Home headers, landing hero areas, and a few key module intros can remain expressive.
Operational pages should be calmer.

### Principle 3 — One dominant accent per module
Within a given section, avoid making red, blue, and yellow all equally loud at once.
One accent should lead; the others should support.

### Principle 4 — Reading hierarchy must win over decoration
Titles, actions, and primary content must always read before chips, shapes, or badges.

### Principle 5 — Motion and shadows should support clarity, not spectacle
Hover lift, box shadows, and border treatments should reinforce hierarchy without making every element shout.

---

## 6. Scope

### In scope

- Global visual tone adjustment
- App shell / background decoration adjustment
- Sidebar and nav readability improvements
- Home / dashboard tone-down
- Jobs page readability improvements
- Optimize page tone-down
- Resume list page tone-down
- Profile preview panel readability improvements
- Rebalancing chips, badges, metadata, and shadows in common card surfaces

### Out of scope

- Full redesign of the information architecture
- Full profile onboarding redesign
- MBTI-like profile flow implementation
- Resume editor redesign
- ATS resume preview redesign
- Data model refactors
- New component library adoption

---

## 7. Current UI Audit Summary

### 7.1 Global styling issues

Primary file:
- `frontend/src/app/globals.css`

Current issues:
- Dot-pattern body background is always visible and slightly too strong.
- Shared Bauhaus classes use heavy default shadows and strong borders.
- Buttons and labels use aggressive tracking and uppercase too frequently.
- Decorative classes are visually strong even on dense utility screens.

### 7.2 App shell issues

Primary file:
- `frontend/src/app/layout.tsx`

Current issues:
- Multiple large geometric shapes are permanently fixed in the background.
- Background decoration is too close to foreground importance.

### 7.3 Sidebar issues

Primary file:
- `frontend/src/components/layout/Sidebar.tsx`

Current issues:
- Every nav item has strong shape, border, icon treatment, and shadow intensity.
- Inactive navigation items are too visually loud.
- Label spacing and all-caps treatment reduce scan efficiency.

### 7.4 Home/dashboard issues

Primary file:
- `frontend/src/app/page.tsx`

Current issues:
- Too many strong modules appear in one viewport.
- Poster-style sections are effective individually but compete when stacked.
- Secondary statistics and platform sections remain too visually loud.

### 7.5 Jobs page issues

Primary file:
- `frontend/src/app/jobs/page.tsx`

Current issues:
- Filters and list surfaces are visually too heavy for a high-density work page.
- Too many controls use strong borders and shadows at the same level.

### 7.6 Job card issues

Primary file:
- `frontend/src/components/jobs/JobCard.tsx`

Current issues:
- Too many chips and colored metadata surfaces compete with title/company.
- Selected and unselected cards are both visually strong.

### 7.7 Onboarding checklist issues

Primary file:
- `frontend/src/components/onboarding/OnboardingChecklist.tsx`

Current issues:
- The checklist is visually effective but too intense for repeated operational use.
- Completed and pending states could be more balanced.

### 7.8 Resume list page issues

Primary file:
- `frontend/src/app/resume/page.tsx`

Current issues:
- Header module and resume cards still compete heavily.
- Thumbnails contain too much decorative geometry relative to the content value.

### 7.9 Profile preview issues

Primary file:
- `frontend/src/app/profile/components/ProfilePreview.tsx`

Current issues:
- Text contrast on dark translucent surfaces is weaker than ideal.
- The panel feels more like a themed widget than a high-trust working summary.

---

## 8. Proposed Solution

## 8.1 Global visual system refinement

Primary file:
- `frontend/src/app/globals.css`

### Required changes

1. **Reduce shared shadow intensity**
   - Lower default box-shadow offset and depth for shared Bauhaus surfaces.
   - Keep stronger shadows only where emphasis is truly needed.

2. **Reduce decorative pattern contrast**
   - Weaken dot and stripe patterns.
   - Increase spacing and decrease opacity.

3. **Refine typographic aggression**
   - Reduce letter spacing on labels and buttons.
   - Reserve heavy uppercase treatment for short labels and hero text only.

4. **Slightly soften the palette in practice**
   - Keep the same red / blue / yellow family.
   - Use them less often at maximum saturation in dense UI.

5. **Make shared chips calmer**
   - Reduce chip border intensity and internal density.
   - Keep them readable but less dominant.

### Expected outcome
The entire product immediately feels calmer without introducing a second design language.

---

## 8.2 Reduce ambient shell decoration

Primary file:
- `frontend/src/app/layout.tsx`

### Required changes

1. Reduce the number of fixed background shapes.
2. Make remaining shapes smaller and lower-opacity.
3. Keep background decoration atmospheric rather than foreground-like.

### Expected outcome
The shell feels branded, but content becomes the obvious first read.

---

## 8.3 Make navigation quieter in its resting state

Primary file:
- `frontend/src/components/layout/Sidebar.tsx`

### Required changes

1. Preserve strong active state.
2. Soften inactive items:
   - lighter shadow,
   - calmer hover state,
   - less decorative contrast.
3. Reduce nav label tracking so items scan faster.
4. Keep one geometric accent per item instead of making every part equally expressive.

### Expected outcome
Navigation still feels custom and branded, but no longer competes with page content.

---

## 8.4 Rebalance emphasis on the dashboard

Primary file:
- `frontend/src/app/page.tsx`

### Required changes

1. Keep one strong hero section.
2. Tone down secondary poster-like modules.
3. Reduce visual intensity in trend/platform blocks.
4. Make statistics read as structured information, not as competing hero cards.

### Expected outcome
The homepage still has personality, but the page becomes easier to scan and understand.

---

## 8.5 Make dense work pages calmer

Primary files:
- `frontend/src/app/jobs/page.tsx`
- `frontend/src/app/optimize/page.tsx`
- `frontend/src/app/resume/page.tsx`

### Required changes

1. Make page headers the expressive part.
2. Make filters, work surfaces, and list areas quieter.
3. Reduce the amount of saturated color blocks in operational zones.
4. Lower shadow and border aggression for secondary controls.

### Expected outcome
These pages feel more usable and less fatiguing while still looking like OfferU.

---

## 8.6 Demote metadata and chip noise in cards

Primary file:
- `frontend/src/components/jobs/JobCard.tsx`

### Required changes

1. Title and company must remain the first read.
2. Chips and metadata should become secondary.
3. Reduce the number of equally strong colored chips shown at once.
4. Keep selection state stronger than resting state.

### Expected outcome
Job cards remain visually distinct, but information hierarchy becomes clearer.

---

## 8.7 Make onboarding and profile summary more trustworthy

Primary files:
- `frontend/src/components/onboarding/OnboardingChecklist.tsx`
- `frontend/src/app/profile/components/ProfilePreview.tsx`

### Required changes

1. Tone down completed/pending card contrast in onboarding.
2. Improve readability of body text and section summaries.
3. Make profile preview feel more like a working summary than a themed showcase.

### Expected outcome
These panels feel more credible, stable, and useful.

---

## 9. Visual Rules for This Pass

1. Use **one dominant accent color per section**.
2. Use heavy shadow only when signaling focus or importance.
3. Metadata must never outcompete primary content.
4. Dense pages should bias toward white or quiet neutral surfaces.
5. Decorative geometry should be accents, not constant interruptions.
6. Brand personality should come from composition and selective contrast, not from making everything loud.

---

## 10. Non-Visual Blocker to Note

There is a profile onboarding mismatch that should be fixed before any deeper profile redesign work.

Relevant files:
- `frontend/src/app/profile/components/ProfileOnboarding.tsx`
- `backend/app/routes/profile.py`

Issue summary:
The onboarding step currently submits fields such as `school`, `major`, `degree`, `gpa`, `email`, and `phone`, but the backend update route is currently shaped around `base_info_json` and a narrower top-level update contract. This creates a risk that onboarding appears to save successfully while not persisting user data in the intended structure.

This is not part of the UI tone-down pass, but it should be addressed before rebuilding the profile experience.

---

## 11. Acceptance Criteria

This PRD is complete when all of the following are true:

1. The product still feels recognizably Bauhaus / geometric.
2. The interface feels less visually noisy.
3. Home, Jobs, Resume, Optimize, Profile, and Settings pages are easier to scan.
4. Inactive UI states are noticeably calmer than active states.
5. Decorative elements no longer compete with primary content.
6. Text hierarchy is clearer across major modules.
7. No critical readability regression is introduced.

---

## 12. Verification Plan

### Manual review pages
- `/`
- `/jobs`
- `/optimize`
- `/resume`
- `/profile`
- `/settings`

### What to verify
1. The product still feels like the same brand.
2. The homepage is less crowded.
3. Dense operational pages are easier to use.
4. Sidebar is quieter when not focused.
5. Cards are more readable.
6. Titles and actions dominate over chips and metadata.
7. Mobile and desktop both retain clear hierarchy.

### Engineering verification
- Run frontend build or type check.
- Review golden-path pages in browser.
- Confirm no obvious contrast or interaction regressions.

---

## 13. Recommended File Targets

### Global system
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`

### High-traffic pages
- `frontend/src/app/page.tsx`
- `frontend/src/app/jobs/page.tsx`
- `frontend/src/app/optimize/page.tsx`
- `frontend/src/app/resume/page.tsx`

### Reused components
- `frontend/src/components/jobs/JobCard.tsx`
- `frontend/src/components/onboarding/OnboardingChecklist.tsx`
- `frontend/src/app/profile/components/ProfilePreview.tsx`

---

## 14. Out of Scope

Do not do these in this PR:

- Replace the Bauhaus identity with generic SaaS minimalism
- Redesign the ATS resume preview
- Rebuild profile onboarding into the conversational / MBTI-like flow
- Introduce a second visual system or component library
- Do broad data-model or API refactors

---

## 15. Follow-up Phase

After this refinement pass is complete, the next design/product phase should focus on:

1. a conversational profile discovery flow,
2. an MBTI-like but non-mechanical onboarding experience,
3. clearer AI Interview and Resume Editor information architecture.

That next phase should build on a calmer visual baseline, not on the current louder one.
