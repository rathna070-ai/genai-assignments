# Complete UI Development Prompt — AI GitHub Code Reviewer

A phase-wise prompt set that builds the custom UI for the n8n code-review workflow from an empty
folder. Run the phases in order; each one assumes the previous is finished and leaves the earlier
work untouched.

---

## Organization Branding Reference

Use this identity consistently across every phase (swap these values for your own organization's
real branding if you have one — everything below is a placeholder identity for this build):

- **Product name:** AI GitHub Code Reviewer
- **Tagline:** "Outstanding code reviews using Artificial Intelligence."
- **Logo concept:** A rounded shield with a `</>` code-bracket glyph inside it, filled with a
  cyan-to-violet gradient and a soft outer glow.
- **Color palette:**
  - Page background: near-black plum (`#0a0212`)
  - Hero gradient: deep purple to black (`#2b0a52` to `#4c1487` to `#1a0736` to `#0a0212`)
  - Primary accent: cyan (`#22d3ee`)
  - Secondary accent: violet (`#a78bfa`)
  - Success / quality signal: emerald (`#34d399`)
  - Warning: amber (`#fbbf24`)
  - Error: red (`#f87171`)
  - Primary text: near-white lavender (`#f5f3ff`); muted (`#b9aed4`); faint (`#8577a3`)
- **Typography:** "Sora" for headings, numbers and pills; "Inter" for body text;
  "JetBrains Mono" for URLs, file paths and branch names.
- **Surfaces:** glassmorphism cards — translucent white fill at ~5% opacity, 1px border at ~12%,
  24px corner radius, heavy soft shadow, backdrop blur.

Deliver as three plain static files with no build step and no runtime dependencies:
`index.html`, `style.css`, `script.js`.

---

## Phase 1 — Build the Complete UI (HTML + CSS only)

I am building an AI-powered GitHub Code Reviewer application.

Please create a beautiful and professional user interface for it. The application should feel
modern, premium and attractive — it should look like a real AI developer-tools product, not a
plain web page.

The requirement:

1. A UI page where I can send a request to n8n and get the output on the same page.
2. A connection point with n8n to receive requests from the UI and send responses back.

**At this stage, only create the HTML structure and CSS styling. Do not write any JavaScript.**

The page should include:

- A sticky header with the logo (shield + code-bracket icon), the product name, navigation links
  (Features, How it Works, Review Code, Contact) and an outlined call-to-action button.
- A hero section with:
  - A small monospaced eyebrow label: `AI-POWERED CODE QUALITY`
  - A large headline, with "Artificial Intelligence" in a cyan-to-violet gradient text fill
  - A short description explaining that the app reviews source code from a GitHub file or
    repository using AI, checking for bugs, code quality, best practices and security issues
  - An outlined "Setup a review" button
  - An abstract graphic on the right: two concentric orbit rings with a glowing cyan orb
  - A wireframe terrain mesh of thin curved SVG lines fading out along the bottom edge
- A "Run a Review" dashboard section with two cards side by side:
  - **Left — "GitHub Repo":** a GitHub-mark icon, a label, a monospaced input field
    (placeholder `https://raw.githubusercontent.com/org/repo/main/File.java`), a hint line, and a
    full-width gradient "Review Code" button.
  - **Right — "Review Result":** a shield-check icon and a large dashed-border panel where the
    review will appear.
- A footer with the logo, product name, the same navigation links and a copyright line.

Initially display in the Review Result panel:

> Waiting for review...

with a softly pulsing cyan dot above it.

Use the palette and typography from the branding reference. The UI should have a soft gradient
background, glassmorphism cards, rounded corners, smooth shadows, and professional spacing.

Make it fully responsive: the hero collapses to a single centred column and the dashboard cards
stack vertically on narrow screens; the nav links may hide on mobile.

---

## Phase 2 — Connect the UI to n8n

Now add `script.js` and wire the UI to the n8n workflow. **Do not change the Phase 1 layout.**

**Endpoint**

```
GET http://localhost:5678/webhook/samplereviewer1
```

Send the GitHub URL as query parameters. Send three aliases so the workflow can read whichever
name it expects:

```
?githubUrl=<url>&repoUrl=<url>&url=<url>
```

> Confirm the HTTP method against the Webhook node before wiring it. If n8n answers
> `This webhook is not registered for POST requests`, the node is registered for GET and the URL
> must travel as a query parameter rather than a JSON body.

**Behaviour when the user clicks "Review Code" or presses Enter:**

1. If the input is empty — outline the input in red, shake the input card, and show a helpful
   message asking for a URL.
2. Otherwise — disable the input and button, change the button label to "Reviewing...", and show
   a spinning ring with "Analyzing your code, please wait..." in the result panel.
3. Call the webhook, then render the response.
4. Re-enable the input and button when finished, whether it succeeded or failed.

**Response handling — make this robust:**

- Read the body with `response.text()` **before** parsing. A `200` with an empty body would make
  `response.json()` throw and get reported as a connection failure, which sends you debugging the
  wrong layer. Report an empty body as exactly that: the Respond to Webhook node returned nothing.
- Unwrap the n8n envelopes: the payload may arrive as the object itself, as `[ {...} ]`, or as
  `[ { json: {...} } ]`.
- Accept a plain string or `{ review: "..." }` as a fallback and show it as preformatted text.
- On a network or workflow failure, show a clear error card rather than breaking the page.

---

## Phase 3 — Render the Structured Review Report

The workflow returns a structured JSON report. Replace the raw text dump in the Review Result
panel with a properly formatted report.

**Response shape:**

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
        { "parameter": "Correctness and Functional Safety", "summary": "...", "score": 18 }
      ],
      "findings": [
        { "severity": "High", "title": "...", "description": "...", "file": "src/A.cs", "line": 42, "suggestion": "..." }
      ],
      "recommended_tests": [
        { "test_type": "Unit", "scenario": "...", "expected_result": "..." }
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

**Render it as four sections, under a report header.**

**Report header** — repo name in monospace, the branch as a cyan pill, a "1 file reviewed" chip,
and `overall_score` as a large gradient number with a `/ 100` suffix, a filled progress bar, and
the `overall_rating` as a coloured pill.

**Scorecard** — one row per entry: the `parameter` name on the left, the `score` on the right, a
thin progress bar beneath, and the `summary` text below that.

> Each parameter is scored out of an equal share of 100, so five parameters means `/20` each
> (in the sample, `18+15+16+15+17 = 81`, matching `overall_score`). Derive the denominator from
> the array length rather than hardcoding it, so a different parameter count still scales.

**Findings** — one card per finding: a severity pill, the title, a monospaced `file:line` chip,
the description, and the suggestion in a highlighted "Suggested fix" block. Colour the card's
left border by severity.

> When `findings` is empty, do not hide the section. With a good score an empty array is the
> result, not missing data — show a green confirmation such as "No findings in the reviewed
> scope."

**Recommended Tests** — one card per test: a numbered gradient badge, the `test_type` as a pill,
the `scenario` as body text, and `expected_result` in a cyan callout prefixed with "Expected:".

**Improvement Summary** — `priority_fixes` and `release_blocking` side by side, each with a count
badge and either a bulleted list or a reassuring empty line ("Nothing blocking release"). Show a
green count when the list is empty, amber for priority fixes, red for release blockers. Below the
pair, render `note` in a violet panel.

**Rules that apply throughout:**

- **Colour follows the data.** Score ratio drives bar colour — green at 85% and above,
  cyan/violet at 70%, amber at 50%, red below. Map rating and severity words onto the same four
  tones so "Good", a green bar and a green pill always agree.
- **Never use `innerHTML` for response content.** Write every value from the reviewer with
  `textContent` or `createTextNode`, so nothing the model returns can inject markup.
- **Match each field against a list of candidate names** (`scenario`/`title`,
  `description`/`summary`, `test_type`/`type`, and so on). If an item matches none of them, print
  the raw object rather than silently dropping it, so a schema change degrades visibly.
- **Loop `files[]`** so a multi-file review works. Show per-file scores only when there is more
  than one file, since with a single file the header already carries it.
- Give the report its own internal scroll (around 620px) with a themed scrollbar, a soft
  staggered entrance animation, and a single-column layout under 700px. Honour
  `prefers-reduced-motion`.

---

## Phase 4 — UX Polish

- Cycle realistic progress messages every 1.5 seconds while waiting ("Fetching file from
  GitHub...", "Analyzing structure...", "Evaluating security...", "Synthesizing
  recommendations...") so the wait feels alive.
- Add an explicit success state — a brief confirmation with the elapsed time.
- Add a copy-to-clipboard control for the report and a "Run another review" reset.
- Refine the error card: distinguish workflow inactive, empty response, and network failure, and
  say what to check for each.

---

## Phase 5 — Premium Branding Pass

- Animate the logo — a slow gradient shimmer or a gentle pulse on the shield.
- Enrich the nav bar with an active-section indicator that follows scroll position.
- Add iconography to the section headings (scorecard, findings, tests, summary).
- Final responsive pass across phone, tablet and wide desktop.

---

## Verification Steps

Run through these after each phase:

1. **Phase 1** — open the page; the hero, both cards and the footer render correctly, the layout
   collapses cleanly on a narrow window, and no JavaScript errors appear in the console.
2. **Phase 2** — with the workflow inactive, clicking "Review Code" shows a clear error rather
   than a blank panel. With an empty input, the card shakes and the input turns red.
3. **Phase 3** — feed the sample payload above through the render path and confirm every section
   appears: header with score and rating, scorecard bars at `/20`, the empty-findings note, all
   test cards, and the improvement summary. Then feed a low-score variant with real findings and a
   release blocker and confirm the colours turn red.
4. **Serve over HTTP**, not `file://` — a `file://` origin makes the webhook call cross-origin in
   a way n8n cannot answer:

   ```
   python -m http.server 8000 --bind 127.0.0.1
   ```

   then open `http://127.0.0.1:8000/`.
