# Phase-wise Implementation — AI GitHub Code Reviewer (samplereviewer1 UI)

A browser UI that sends a GitHub file/repository URL to an n8n workflow and renders the
returned structured code-review report in place.

- **UI:** static `index.html` + `style.css` + `script.js` (no build step, no dependencies)
- **Webhook:** `http://localhost:5678/webhook/samplereviewer1` (**GET**)
- **Served at:** `http://127.0.0.1:8000/`

---

## 1. System Overview

```mermaid
flowchart LR
    U[User<br/>Browser] -->|1. Enter GitHub URL<br/>Click "Review Code"| UI[Custom UI<br/>index.html / style.css / script.js]
    UI -->|2. GET ?githubUrl=...| WH[n8n Webhook Node<br/>GET /webhook/samplereviewer1]
    WH --> HTTP[HTTP Request Node<br/>GET raw GitHub file]
    HTTP --> LLM[LLM Chain<br/>structured review prompt]
    LLM --> RESP[Respond to Webhook Node<br/>JSON review report]
    RESP -->|3. JSON response| UI
    UI -->|4. Render scorecard, findings,<br/>tests, improvement summary| U
```

---

## 2. Implementation Phases

| Phase | Status | Description |
|---|---|---|
| **Phase 0 — Baseline duplicate** | Done | Copied the three UI files from the `GITHUB_reviewer1` build byte-for-byte (checksum-verified), preserving the existing dark-purple design, fonts and animations. Only the webhook binding was changed afterwards. |
| **Phase 1 — Structure & styling** | Done | HTML/CSS only. Sticky navbar, hero with orbit-ring graphic and wireframe mesh, "GitHub Repo" input card, "Review Result" card, footer. Purple-to-black gradient with cyan/violet accents. No JavaScript. |
| **Phase 2 — n8n connection** | Done | `script.js` reads the URL field, validates empty input, calls the webhook, and drives the waiting / loading / error / result states. Method corrected from POST to **GET** after n8n rejected POST. |
| **Phase 3 — Structured report rendering** | Done | Replaced the raw JSON/plain-text dump with a real report: header, **Scorecard**, **Findings**, **Recommended Tests**, **Improvement Summary**. |
| **Phase 4 — UX polish** | Not started | Progress status messages that cycle during the wait, refined success state, explicit copy/export of the report. |
| **Phase 5 — Premium branding pass** | Not started | Animated logo, richer nav bar, additional iconography, final responsive polish. |

---

## 3. Phase Detail

### Phase 0 — Baseline duplicate

Source: `github-code-reviewer-agent-custom-ui/ui/`. All three files copied unchanged and
verified identical by checksum before any edit, so the visual design is a known-good starting
point rather than a re-implementation.

### Phase 1 — Structure & styling

Design tokens live in `:root` in `style.css` and everything downstream references them:

| Token | Value | Role |
|---|---|---|
| `--bg-deep` | `#0a0212` | Page background |
| `--bg-purple-1/2/3` | `#2b0a52` / `#4c1487` / `#1a0736` | Hero gradient stops |
| `--accent-cyan` | `#22d3ee` | Primary accent, links, focus rings |
| `--accent-violet` | `#a78bfa` | Secondary accent, gradients |
| `--accent-success` | `#34d399` | Passing scores, "no findings" |
| `--accent-warning` | `#fbbf24` | Middling scores, priority fixes |
| `--accent-error` | `#f87171` | Low scores, release blockers |
| `--font-heading` | Sora | Headings, numbers, pills |
| `--font-body` | Inter | Body copy |
| `--font-mono` | JetBrains Mono | URLs, file paths, branch names |

### Phase 2 — n8n connection

**Method correction.** The first live probe returned:

```
HTTP/1.1 500 Internal Server Error
Access-Control-Allow-Methods: OPTIONS, GET
{"message":"This webhook is not registered for POST requests. Did you mean to make a GET request?"}
```

The Webhook node is registered for GET, so the URL now travels as a query parameter instead of
a JSON body. Three aliases are sent so the workflow can read whichever name it expects:

```
GET /webhook/samplereviewer1?githubUrl=<url>&repoUrl=<url>&url=<url>
```

**CORS.** Confirmed working — n8n echoes the page origin, so no extra configuration is needed:

```
Access-Control-Allow-Origin: http://127.0.0.1:8000
```

**Empty-body guard.** The response is read with `response.text()` before parsing. A `200` with an
empty body would otherwise make `response.json()` throw `SyntaxError: Unexpected end of JSON
input`, which the catch block would report as a connection failure — sending you to debug the
wrong layer. It now reports that the Respond to Webhook node returned nothing.

### Phase 3 — Structured report rendering

Rendering is driven entirely by the response shape. `unwrapPayload()` peels the n8n wrappers
(`[ {...} ]` and `[ { json: {...} } ]`), then `isReviewReport()` decides between the structured
renderer and the legacy plain-text path.

| Section | Source field | Rendering |
|---|---|---|
| Report header | `repo`, `branch`, `files_reviewed`, `overall_score`, `overall_rating` | Repo in mono, branch pill, file count chip, large gradient score with progress bar, rating pill |
| **Scorecard** | `files[].scorecard[]` | One row per `parameter` with `score`, a progress bar, and the `summary` text |
| **Findings** | `files[].findings[]` | Severity pill, title, `file:line` chip, description, highlighted suggested fix |
| **Recommended Tests** | `files[].recommended_tests[]` | Numbered badge, `test_type` pill, `scenario` body, `expected_result` callout |
| **Improvement Summary** | `files[].improvement_summary` | `priority_fixes` and `release_blocking` as counted groups, then `note` |

**Scorecard denominator.** Each parameter is scored out of an equal share of 100, so five
parameters render as `/20` each — consistent with the sample where `18+15+16+15+17 = 81` equals
`overall_score`. The divisor is derived from the array length (`100 / n`, floored at the largest
observed score) rather than hardcoded, so a workflow with a different parameter count still
scales correctly.

**Colour tone.** Score ratio drives bar colour — green at 85% and above, cyan/violet at 70%,
amber at 50%, red below. Rating and severity words map onto the same four tones.

**Empty findings are a result, not missing data.** With a score of 81 and `findings: []`, the
section renders a green confirmation rather than disappearing.

**Safety.** Every value from the reviewer is written with `textContent` (or `createTextNode`),
never `innerHTML`, so no response can inject markup into the page.

**Unknown fields degrade rather than vanish.** Each field is matched against a list of candidate
names (`scenario`/`title`, `description`/`summary`, `test_type`/`type`, ...). If an item matches
none of them, the raw object is printed instead of being silently dropped.

---

## 4. Data Contract

**Request** — UI to n8n:

```
GET http://localhost:5678/webhook/samplereviewer1?githubUrl=<url>&repoUrl=<url>&url=<url>
```

n8n expression to read it: `{{ $json.query.githubUrl }}`

**Response** — n8n to UI:

```json
{
  "repo": "owner/repository",
  "branch": "main",
  "overall_score": 81,
  "files_reviewed": 1,
  "files": [
    {
      "file": "backend/WebTestToolkit.Api/AssemblyInfo.cs",
      "overall_score": 81,
      "overall_rating": "Good",
      "scorecard": [
        { "parameter": "Correctness and Functional Safety", "summary": "...", "score": 18 },
        { "parameter": "Security, Privacy, and Compliance", "summary": "...", "score": 15 },
        { "parameter": "Maintainability and Code Quality", "summary": "...", "score": 16 },
        { "parameter": "Testability and Reliability", "summary": "...", "score": 15 },
        { "parameter": "Technical Feasibility and Operational Readiness", "summary": "...", "score": 17 }
      ],
      "findings": [
        {
          "severity": "High",
          "title": "Missing null check",
          "description": "...",
          "file": "src/A.cs",
          "line": 42,
          "suggestion": "..."
        }
      ],
      "recommended_tests": [
        {
          "test_type": "Unit",
          "scenario": "...",
          "expected_result": "..."
        }
      ],
      "improvement_summary": {
        "priority_fixes": [],
        "release_blocking": [],
        "note": "..."
      }
    }
  ]
}
```

`files[]` is looped, so a multi-file review works without changes — per-file scores appear on
each block once there is more than one entry.

---

## 5. Local Environment

| Service | URL | Notes |
|---|---|---|
| n8n editor / webhook host | `http://localhost:5678` | Webhook path `/webhook/samplereviewer1`, method **GET** |
| UI (served) | `http://127.0.0.1:8000/` | `python -m http.server 8000 --bind 127.0.0.1` from the UI folder |

Serve over HTTP rather than opening the file directly — a `file://` origin makes the webhook
call a cross-origin request that n8n cannot answer with a matching `Access-Control-Allow-Origin`.

---

## 6. Verification

| Check | Method | Result |
|---|---|---|
| Webhook method | `OPTIONS` preflight | GET only — POST rejected |
| CORS | `Origin` header on a live call | `Access-Control-Allow-Origin` echoed correctly |
| Report rendering | Real payload through the actual `script.js` render path with a DOM stub | Header, scorecard `/20` bars, empty-findings note, three test cards, improvement summary all correct |
| Low-score path | Same harness with `Poor` / 42, two findings, one release blocker | Red tone end to end, findings and blocker lists populated |
| n8n wrapper handling | `[ { json: payload } ]` | Unwrapped and detected as a report |
| Syntax | `node --check script.js` | Passes |

---

## 7. Open Items

1. **The workflow currently returns `200` with an empty body.** The webhook is registered and
   responding, and CORS is correct, but the Respond to Webhook node is not returning the review
   JSON. Until that is fixed the UI shows the empty-response message. This is an n8n
   configuration item, not a UI one.
2. **Phase 4 and 5** (UX polish, premium branding) are not started.
3. **Multi-file rendering is implemented but untested against real data** — every sample so far
   has had `files_reviewed: 1`.

---

## 8. Repository Layout

```
samplereviewer1-ui/
├── phase-wise-implementation.md   (this file)
├── ui-development-prompt.md        phase-wise UI build prompt
├── index.html                      structure
├── style.css                       theme tokens + report styles
└── script.js                       webhook call + report rendering
```
