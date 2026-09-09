# Architecture — AI GitHub Code Reviewer (Custom UI)

## 1. System Overview

The application is a browser-based UI that sends a GitHub file/repository URL to an n8n
workflow over a webhook. The workflow fetches the file, runs it through an LLM-based
review chain, and responds synchronously with the review, which the UI renders in place.

```mermaid
flowchart LR
    U[User<br/>Browser] -->|1. Enter GitHub URL<br/>Click "Review Code"| UI[Custom UI<br/>index.html / style.css / script.js]
    UI -->|2. POST JSON<br/>{ githubUrl }| WH[n8n Webhook Node<br/>POST /webhook/GITHUB_reviewer1]
    WH --> HTTP[HTTP Request Node<br/>GET raw GitHub file]
    HTTP --> LLM[Basic LLM Chain<br/>+ Groq Chat Model]
    LLM --> RESP[Respond to Webhook Node<br/>JSON: { review: text }]
    RESP -->|3. JSON response| UI
    UI -->|4. Render in<br/>Review Result panel| U
```

## 2. Components

| Component | Type | Responsibility |
|---|---|---|
| `index.html` / `style.css` | Static frontend | Page structure, branding, layout, responsive design |
| `script.js` | Static frontend | Reads the URL field, validates input, calls the webhook, renders loading/success/error states |
| Local UI server | Node static server (`serve-github-reviewer-ui.js`) | Serves the UI over `http://localhost:8735/` instead of `file://`, avoiding CORS edge cases when calling the webhook |
| Webhook node | n8n trigger | First node in the workflow; receives the POST request, responds via a **Respond to Webhook** node instead of an immediate ack |
| HTTP Request node | n8n | `GET`s the raw GitHub file content from the URL supplied in the webhook body |
| Basic LLM Chain node | n8n / LangChain | Builds the code-review prompt from the fetched file content |
| Groq Chat Model node | n8n / LangChain | LLM backend (e.g. `llama-3.3-70b-versatile` / `openai/gpt-oss-120b`) attached to the LLM Chain |
| Respond to Webhook node | n8n | Last node; returns the review as JSON directly to the UI (replaces the original Send Email / Convert to File nodes) |

## 3. Data Contract

**Request** — UI → n8n (`POST http://localhost:5678/webhook/GITHUB_reviewer1`):

```json
{
  "githubUrl": "https://raw.githubusercontent.com/org/repo/main/File.java"
}
```

n8n expression to read it: `{{ $json.body.githubUrl }}`

**Response** — n8n → UI:

```json
{
  "review": "<AI-generated code review text>"
}
```

`script.js` unwraps `review`, `text`, `output`, or `message` from the response (or a raw
string / first array element) so the exact key name isn't fragile.

## 4. Implementation Phases

### n8n Workflow Phases

| Phase | Status | Description |
|---|---|---|
| 1. Baseline agent | ✅ Done (reference) | Original flow: **On Form Submission → HTTP Request → Basic LLM Chain → Groq Chat Model → Send an Email / Convert to File**, per `Steps to Create GitHub code reviewer Agent.txt` |
| 2. Webhook conversion | ⏳ In progress | Replace **On Form Submission** with a **Webhook** node (`POST`, respond via "Respond to Webhook node") as the first node, matching the pattern already used in `Userstory_Reviewer1.json` |
| 3. Response conversion | ⏳ In progress | Replace **Send an Email / Convert to File** with a **Respond to Webhook** node returning `{ "review": $json.text }` as the last node |
| 4. Prompt/path fix for GitHub content | ⏳ Pending | Update the HTTP Request node to read `{{ $json.body.githubUrl }}`, and update the Basic LLM Chain prompt to reference the raw file content returned by HTTP Request rather than the Jira `.issues[0]` shape used in the reference template |

> Current status: a live test POST to the webhook returns `HTTP 200` with an **empty body**,
> which means phases 2–3 are wired (the webhook is registered and responding) but phase 4
> still needs verification — most likely the LLM Chain prompt or HTTP Request expression is
> still pointing at the old Jira-shaped data path.

### Custom UI Phases

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Structure & Styling | ✅ Done | HTML/CSS only. Header, hero, "GitHub Repo" input card, "Review Result" card, footer. Branding: "AI GitHub Code Reviewer", purple-to-black gradient theme with glowing cyan/violet accents, wireframe hero graphic, pill buttons — restyled to match the supplied reference screenshot. No JavaScript. |
| Phase 2 — n8n Connection | ✅ Done | `script.js` added. Reads the URL field, validates empty input, POSTs `{ githubUrl }` to the n8n webhook, shows a loading state, renders the response, and shows a friendly error on failure. Layout from Phase 1 unchanged. |
| Phase 3 — UX Polish | ⏳ Not started | Planned: refined loading animation, better button/transition effects, explicit success state, refined error state — see `Prompt for custom UI - GitHub Code Reviewer.md`. |
| Phase 4 — Premium Branding Pass | ⏳ Not started | Planned: animated logo, richer nav bar, additional icons, final responsive polish for a "commercial AI SaaS product" feel. |

## 5. Local Environment

| Service | URL | Notes |
|---|---|---|
| n8n editor / webhook host | `http://localhost:5678` | Webhook path: `/webhook/GITHUB_reviewer1` |
| UI (served) | `http://localhost:8735` | Serves `ui/index.html`, `ui/style.css`, `ui/script.js` |

## 6. Repository Layout

```
github-code-reviewer-agent-custom-ui/
├── architecture.md                              (this file)
├── intent.md                                     project intent & scope
├── Prompt for custom UI - GitHub Code Reviewer.md  phase-wise UI prompt
└── ui/
    ├── index.html
    ├── style.css
    └── script.js
```
