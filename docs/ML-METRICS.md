# ML Metrics Reference — NeedMap-AI

All scoring is rule-based (no training data). Every constant is named and tunable.
Scores are normalised to **0–100** before storage/response.

---

## 1. Need Priority Score

**Function:** `app/ml/priority.py → compute_priority_score()`
**Stored in:** `Need.priority_score`
**Auto-triggered:** `POST /needs`, `PATCH /needs/{id}` (if urgency/category/description changed)
**Manual trigger:** `POST /needs/{id}/compute-priority`

### Components & Weights

| # | Component | Weight | Range | Logic | Constant |
|---|---|---|---|---|---|
| 1 | **Urgency** | **35%** | 0–1 | Fixed lookup table | — |
| 2 | **Category** | **25%** | 0–1 | Fixed lookup table | — |
| 3 | **Source count** | **10%** | 0–1 | `min(count / MAX_SOURCES_FOR_FULL_SCORE, 1.0)` | `MAX_SOURCES_FOR_FULL_SCORE = 5` |
| 4 | **Keyword density** | **10%** | 0–1 | Urgency keywords in description, `min(hits / KEYWORD_SATURATION_THRESHOLD, 1.0)` | `KEYWORD_SATURATION_THRESHOLD = 3` |
| 5 | **Geo-density** | **10%** | 0–1 | `min(nearby_open_needs / GEO_DENSITY_SATURATION, 1.0)` — cluster signals disaster zone | `GEO_DENSITY_SATURATION = 10` |
| 6 | **Age decay** | **10%** | 0–1 | `min(days_unresolved / AGE_DECAY_DAYS, 1.0)` — older unresolved → higher urgency | `AGE_DECAY_DAYS = 30` |

### Urgency Lookup (Component 1 — 35%)

| Value | Score | Points (of 100) |
|---|---|---|
| critical | 1.00 | 35 |
| high | 0.75 | 26.25 |
| medium | 0.50 | 17.5 |
| low | 0.25 | 8.75 |

**Why 35%:** Urgency is the fastest-changing, most operator-controlled signal. It directly captures how time-sensitive the need is and should dominate the score.

### Category Lookup (Component 2 — 25%)

| Category | Score | Points (of 100) | Reason |
|---|---|---|---|
| water_access | 1.00 | 25 | Fundamental survival need, hours to dehydration |
| health | 1.00 | 25 | Medical emergencies are directly life-threatening |
| shelter | 0.90 | 22.5 | Exposure risk, especially with children/elderly |
| food | 0.85 | 21.25 | Critical survival but slightly slower onset than water |
| sanitation | 0.80 | 20 | Disease outbreak potential if unaddressed |
| mental_health | 0.70 | 17.5 | Crisis intervention time-sensitive but rarely minutes |
| legal_aid | 0.65 | 16.25 | Deadlines matter but rarely life-threatening immediately |
| education | 0.60 | 15 | Long-term impact; rarely acute |
| clothing | 0.55 | 13.75 | Comfort and dignity need; acute only in extreme cold |
| transportation | 0.40 | 10 | Usually enables other needs rather than being the need itself |
| other | 0.35 | 8.75 | Catch-all; unknown severity |

**Why 25%:** Category is a stable structural signal — it doesn't change after creation. Second-highest weight because it represents the inherent severity ceiling of the need type.

### Source Count (Component 3 — 10%)

Saturates at **5 sources** → 1.0. Each additional corroborating source (image, report, field survey) increases confidence the need is real.

| Sources | Raw score | Points |
|---|---|---|
| 0 | 0.00 | 0 |
| 1 | 0.20 | 2 |
| 3 | 0.60 | 6 |
| 5+ | 1.00 | 10 |

**Why 10%:** Corroboration matters but a single well-documented urgent need must still score high. Capped to prevent gaming by flooding sources.

### Keyword Density (Component 4 — 10%)

Scans `description` for urgency keywords (`urgent`, `critical`, `emergency`, `dying`, `no water`, `no food`, `sos`, etc.). Saturates at **3 keyword hits**.

| Keyword hits | Raw score | Points |
|---|---|---|
| 0 | 0.00 | 0 |
| 1 | 0.33 | 3.3 |
| 2 | 0.67 | 6.7 |
| 3+ | 1.00 | 10 |

**Why 10%:** Captures free-text signals that structured fields miss. Low weight because text can be noisy — only reinforcing, not dominant.

### Geo-Density (Component 5 — 10%)

Count of nearby open needs within ~5 km (bounding box approximation). Saturates at **10 nearby needs**.

| Nearby open needs | Raw score | Points |
|---|---|---|
| 0 | 0.00 | 0 |
| 5 | 0.50 | 5 |
| 10+ | 1.00 | 10 |

**Why 10%:** A cluster of needs in one area signals a systemic event (flood, fire, displacement). Helps surface disaster zones vs isolated incidents.

### Age Decay (Component 6 — 10%)

Days since `need.created_at`. Saturates at **30 days**.

| Days unresolved | Raw score | Points |
|---|---|---|
| 0 | 0.00 | 0 |
| 7 | 0.23 | 2.3 |
| 15 | 0.50 | 5 |
| 30+ | 1.00 | 10 |

**Why 10%:** An unresolved need grows more urgent over time. Low weight because recency alone shouldn't override actual urgency — it just ensures old needs don't fall off the radar.

### Example Scores

| Scenario | Priority Score | Breakdown |
|---|---|---|
| critical + water_access + 3 sources + 3 keywords | **87.33** | 35 + 25 + 6 + 10 + 0 + 0 (+ geo/age if any) |
| low + transportation + 0 sources + 0 keywords | **18.75** | 8.75 + 10 + 0 + 0 + 0 + 0 |
| medium + health + 1 source | **44.5** | 17.5 + 25 + 2 + 0 + 0 + 0 |

### Threshold Guidance

There are no hard thresholds in code — priority_score is a continuous signal. Typical usage:
- **≥ 75** — Escalate / page on-call coordinator
- **50–74** — Active queue, assign within 24 h
- **25–49** — Monitor, assign within 72 h
- **< 25** — Low priority, review weekly

---

## 2. Volunteer–Need Match Score

**Function:** `app/ml/matching.py → score_volunteers_for_need()`
**Stored in:** `Assignment.match_score`
**Exposed via:** `GET /needs/{id}/suggest-volunteers`
**Auto-populated:** `POST /assignments` (if `match_score` not provided)

### Components & Weights

| # | Component | Weight | Range | Logic | Constant |
|---|---|---|---|---|---|
| 1 | **Skill match** | **40%** | 0–1 | Best proficiency weight for need category's skills | `PROFICIENCY_WEIGHT` |
| 2 | **Geo proximity** | **30%** | 0–1 | `max(0, 1 - geodesic_km / radius_km)` | `DEFAULT_RADIUS_KM = 50` |
| 3 | **Reliability** | **20%** | 0–1 | Composite: rating 50% + tasks 30% + verified 20% | `MAX_RATING = 5.0`, `EXPERIENCED_TASK_COUNT = 20` |
| 4 | **Availability** | **10%** | 0 or 1 | Binary: 1.0 if available and not overloaded | `ACTIVE_TASK_THRESHOLD = 5` |

### Skill Match (Component 1 — 40%)

Maps need category → relevant canonical skills via `CATEGORY_SKILL_MAP`, then checks each volunteer skill against keyword lists in `SKILL_TAXONOMY`. Takes the **best-matching** skill's proficiency score.

**Proficiency → score:**

| Proficiency | Score | Points (of 100) |
|---|---|---|
| expert | 1.00 | 40 |
| intermediate | 0.70 | 28 |
| beginner | 0.40 | 16 |
| no match | 0.00 | 0 |

**Why 40%:** The most task-relevant signal. Sending a plumber to a water crisis is directly useful; sending a cook is not. Without skill match, proximity alone shouldn't win.

### Geo Proximity (Component 2 — 30%)

Linear decay: `score = max(0, 1 - distance_km / effective_radius)`. If the volunteer has no location set, returns **0.5** (neutral — don't penalise volunteers who haven't set location).

| Distance | Score (at 50 km radius) | Points |
|---|---|---|
| 0 km | 1.00 | 30 |
| 25 km | 0.50 | 15 |
| 50 km | 0.00 | 0 |
| No location | 0.50 (neutral) | 15 |

**Why 30%:** Physical proximity is the second strongest factor — a highly-skilled volunteer 500 km away is less actionable than a competent one 2 km away. Linear (not exponential) decay is intentional; a gradual penalty, not a cliff.

### Reliability (Component 3 — 20%)

Composite of three sub-signals:

| Sub-signal | Sub-weight | Logic | Constant |
|---|---|---|---|
| Rating | 50% | `rating / MAX_RATING` | `MAX_RATING = 5.0` |
| Tasks completed | 30% | `min(tasks / EXPERIENCED_TASK_COUNT, 1.0)` | `EXPERIENCED_TASK_COUNT = 20` |
| Verified | 20% | 1.0 if `volunteer.verified`, else 0.0 | — |

**Why these sub-weights:**
- Rating 50% — direct peer feedback is the strongest quality signal. 100 tasks at 2★ < 5 tasks at 5★.
- Tasks 30% — experience matters but is secondary to demonstrated quality.
- Verified 20% — org-issued credential check is meaningful but binary; a new excellent volunteer shouldn't be heavily penalised for not yet being verified.

Full reliability contributes max **20 points** to composite.

### Availability (Component 4 — 10%)

Binary: **1.0** if `volunteer.availability == True` AND `active_tasks < ACTIVE_TASK_THRESHOLD (5)`, else **0.0**.

**Why 10%:** Availability is a hard constraint, not a soft preference. Low weight because an unavailable volunteer should still appear in the list (for planning/future assignment) — just ranked lower. If it were higher (e.g. 40%), an available-but-unskilled volunteer could outrank an unavailable expert.

---

## 3. OCR Extraction (NeedSource Enrichment)

**Function:** `app/ml/ocr.py → run_ocr_pipeline()`
**Stored in:** `NeedSource.multimedia_txt`, `NeedSource.ai_extraction`
**Triggered via:** `POST /needs/ocr-extract`

### Output Fields

| Field | Max size | Content |
|---|---|---|
| `multimedia_txt` | 500 chars | Raw OCR text — stored verbatim for search/audit |
| `ai_extraction` | 500 chars | JSON string of structured fields |
| `structured.category_hint` | — | First NeedCategory whose keywords appear in text |
| `structured.urgency_hint` | — | `"critical"` or `"high"` based on keyword severity |
| `structured.address_hint` | — | First address-like string from regex match |
| `structured.keywords_found` | — | All urgency keywords detected |

### Urgency Detection Tiers

| Tier | Keywords | Returned |
|---|---|---|
| Critical | dying, life-threatening, emergency, critical, sos, no water, no food, no shelter | `"critical"` |
| High | urgent, immediate, crisis, danger, severe, acute, desperate, asap, today | `"high"` |
| None | (nothing matched) | `null` |

**Why two tiers:** "I need help today" is different from "patient is dying". Callers can use `urgency_hint` to pre-fill the `NeedCreateRequest.urgency` field — the critical/high split prevents over-escalating soft urgency language.

### EasyOCR Singleton

The Reader initialises once per process (~5–10 s, ~200 MB PyTorch model). Subsequent calls are fast. GPU controlled by `OCR_USE_GPU` env var (default `true`). Set `OCR_USE_GPU=false` on CPU-only hosts.

---

## Skill Extraction (Volunteer Onboarding)

**Function:** `app/ml/matching.py → extract_skills_from_text()`
**Auto-triggered:** `POST /volunteers` (if `bio` provided)
**Extracted skills created with:** `proficiency = beginner`

Scans bio text against `SKILL_TAXONOMY` keyword lists (12 canonical skills). Returns canonical skill names. These are then auto-registered as `VolunteerSkill` records so the matching scorer can use them immediately.

**Why beginner default:** We cannot infer proficiency from the presence of a keyword alone — "I studied medicine" ≠ "expert". Beginner is the safest assumption; volunteers can upgrade proficiency manually.
