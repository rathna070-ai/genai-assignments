(function () {
  "use strict";

  // n8n production webhook for the GitHub Code Reviewer workflow.
  const WEBHOOK_URL = "http://localhost:5678/webhook/samplereviewer1";

  const repoCard = document.querySelector(".repo-card");
  const repoInput = document.getElementById("repoUrl");
  const reviewBtn = document.getElementById("reviewBtn");
  const resultBody = document.getElementById("resultBody");

  /* ---------------------------------------------------------------
     DOM helpers. Every value coming back from the reviewer is set via
     textContent, so no response can inject markup into the page.
     --------------------------------------------------------------- */

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null && text !== "") {
      node.textContent = String(text);
    }
    return node;
  }

  function has(v) {
    return v !== undefined && v !== null && v !== "";
  }

  // First non-empty value among several candidate key names.
  function firstOf(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    for (let i = 0; i < keys.length; i++) {
      if (has(obj[keys[i]])) return obj[keys[i]];
    }
    return null;
  }

  // Ratio 0..1 to a tone name used for colour.
  function toneForRatio(ratio) {
    if (ratio >= 0.85) return "great";
    if (ratio >= 0.7) return "good";
    if (ratio >= 0.5) return "fair";
    return "poor";
  }

  function toneForWord(word) {
    const s = String(word || "").toLowerCase();
    if (s.indexOf("excellent") > -1 || s.indexOf("outstanding") > -1) return "great";
    if (s.indexOf("good") > -1 || s.indexOf("solid") > -1 || s.indexOf("strong") > -1) return "good";
    if (s.indexOf("low") > -1 || s.indexOf("minor") > -1 || s.indexOf("info") > -1) return "good";
    if (s.indexOf("fair") > -1 || s.indexOf("average") > -1 || s.indexOf("moderate") > -1) return "fair";
    if (s.indexOf("medium") > -1 || s.indexOf("warning") > -1 || s.indexOf("needs") > -1) return "fair";
    if (s.indexOf("poor") > -1 || s.indexOf("weak") > -1 || s.indexOf("fail") > -1) return "poor";
    if (s.indexOf("critical") > -1 || s.indexOf("severe") > -1 || s.indexOf("high") > -1) return "poor";
    if (s.indexOf("blocker") > -1 || s.indexOf("major") > -1) return "poor";
    return "neutral";
  }

  /* ---------------------------------------------------------------
     Result panel states
     --------------------------------------------------------------- */

  function resetPanel() {
    resultBody.classList.remove("has-error");
    resultBody.classList.remove("has-report");
    resultBody.innerHTML = "";
  }

  function setWaitingState() {
    resetPanel();
    resultBody.innerHTML =
      '<div class="placeholder-state">' +
      '<span class="pulse-dot" aria-hidden="true"></span>' +
      "<p>Waiting for review...</p>" +
      "</div>";
  }

  function setLoadingState() {
    resetPanel();
    resultBody.innerHTML =
      '<div class="placeholder-state">' +
      '<span class="loader-ring" aria-hidden="true"></span>' +
      "<p>Analyzing your code, please wait...</p>" +
      "</div>";
  }

  function setMessageState(message) {
    resetPanel();
    resultBody.classList.add("has-error");
    const wrap = el("div", "placeholder-state state-error");
    wrap.appendChild(el("p", null, message));
    resultBody.appendChild(wrap);
  }

  const setValidationMessage = setMessageState;
  const setErrorState = setMessageState;

  /* ---------------------------------------------------------------
     Response unwrapping
     --------------------------------------------------------------- */

  // n8n returns the object itself, [ {...} ], or [ { json: {...} } ]
  // depending on how the Respond to Webhook node is wired.
  function unwrapPayload(data, depth) {
    depth = depth || 0;
    if (depth > 5 || !data || typeof data !== "object") return data;
    if (Array.isArray(data)) return unwrapPayload(data[0], depth + 1);
    if (data.json && typeof data.json === "object") {
      return unwrapPayload(data.json, depth + 1);
    }
    const keys = Object.keys(data);
    if (keys.length === 1 && (keys[0] === "data" || keys[0] === "body") &&
        data[keys[0]] && typeof data[keys[0]] === "object") {
      return unwrapPayload(data[keys[0]], depth + 1);
    }
    return data;
  }

  function isReviewReport(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return false;
    return (
      Array.isArray(d.files) ||
      Array.isArray(d.scorecard) ||
      Array.isArray(d.findings) ||
      Array.isArray(d.recommended_tests) ||
      has(d.improvement_summary) ||
      has(d.overall_score) ||
      has(d.overall_rating)
    );
  }

  // Legacy shape: { review: "..." }, a bare string, or a first array element.
  function extractReviewText(data) {
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return extractReviewText(data[0]);
    if (data && typeof data === "object") {
      return data.review || data.text || data.output || data.message ||
             JSON.stringify(data, null, 2);
    }
    return String(data);
  }

  /* ---------------------------------------------------------------
     Shared pieces
     --------------------------------------------------------------- */

  function buildScoreGauge(score, max) {
    const num = Number(score);
    const wrap = el("div", "score-block");

    const gauge = el("div", "score-gauge");
    gauge.appendChild(el("span", "score-value", score));
    if (Number.isFinite(num)) gauge.appendChild(el("span", "score-max", "/ " + max));
    wrap.appendChild(gauge);

    if (Number.isFinite(num)) {
      const ratio = Math.max(0, Math.min(1, num / max));
      const track = el("div", "score-track");
      const fill = el("div", "score-fill tone-" + toneForRatio(ratio));
      fill.style.width = ratio * 100 + "%";
      track.appendChild(fill);
      wrap.appendChild(track);
    }
    return wrap;
  }

  function buildSection(label, count, bodyNode) {
    const section = el("section", "report-section");
    const heading = el("h3", "report-section-title");
    heading.appendChild(el("span", "report-section-label", label));
    if (count !== null && count !== undefined) {
      heading.appendChild(el("span", "report-count", count));
    }
    section.appendChild(heading);
    section.appendChild(bodyNode);
    return section;
  }

  function buildEmptyNote(text) {
    const note = el("div", "empty-note");
    note.appendChild(el("span", "empty-check", "✓"));
    note.appendChild(el("span", null, text));
    return note;
  }

  /* ---------------------------------------------------------------
     Scorecard
     --------------------------------------------------------------- */

  function buildScorecard(rows) {
    // Each parameter is scored out of an equal share of 100, so five
    // parameters means 20 points each. Fall back to the largest observed
    // score if a workflow uses a different scale.
    const scores = rows.map(function (r) { return Number(firstOf(r, ["score", "value", "points"])); })
                       .filter(function (n) { return Number.isFinite(n); });
    const observedMax = scores.length ? Math.max.apply(null, scores) : 0;
    const perMax = Math.max(Math.round(100 / rows.length), observedMax);

    const list = el("ul", "scorecard-list");

    rows.forEach(function (row, i) {
      const item = el("li", "score-row");

      if (typeof row !== "object" || row === null) {
        item.appendChild(el("p", "score-row-summary", String(row)));
        list.appendChild(item);
        return;
      }

      const param = firstOf(row, ["parameter", "name", "criterion", "category", "title"]);
      const summary = firstOf(row, ["summary", "description", "comment", "detail", "notes"]);
      const raw = firstOf(row, ["score", "value", "points"]);
      const num = Number(raw);

      const head = el("div", "score-row-head");
      head.appendChild(el("span", "score-row-param", param || "Parameter " + (i + 1)));

      if (has(raw)) {
        const value = el("span", "score-row-score");
        value.appendChild(el("span", "score-row-num", raw));
        if (Number.isFinite(num)) value.appendChild(el("span", "score-row-max", "/" + perMax));
        head.appendChild(value);
      }
      item.appendChild(head);

      if (Number.isFinite(num) && perMax > 0) {
        const ratio = Math.max(0, Math.min(1, num / perMax));
        const track = el("div", "score-track thin");
        const fill = el("div", "score-fill tone-" + toneForRatio(ratio));
        fill.style.width = ratio * 100 + "%";
        track.appendChild(fill);
        item.appendChild(track);
      }

      if (summary) item.appendChild(el("p", "score-row-summary", summary));
      list.appendChild(item);
    });

    return list;
  }

  /* ---------------------------------------------------------------
     Findings
     --------------------------------------------------------------- */

  const F_SEV = ["severity", "level", "priority", "impact", "type"];
  const F_TITLE = ["title", "issue", "name", "heading", "category", "rule", "parameter"];
  const F_BODY = ["description", "summary", "message", "detail", "details", "explanation", "body", "text"];
  const F_FILE = ["file", "path", "filename", "file_path", "location"];
  const F_LINE = ["line", "line_number", "lineNumber", "start_line"];
  const F_FIX = ["suggestion", "recommendation", "fix", "remediation", "resolution", "how_to_fix"];

  function buildFindings(items) {
    const list = el("ul", "findings-list");

    items.forEach(function (item, i) {
      if (typeof item !== "object" || item === null) {
        const simple = el("li", "finding tone-neutral");
        simple.appendChild(el("p", "finding-body", String(item)));
        list.appendChild(simple);
        return;
      }

      const sev = firstOf(item, F_SEV);
      const title = firstOf(item, F_TITLE);
      const body = firstOf(item, F_BODY);
      const file = firstOf(item, F_FILE);
      const line = firstOf(item, F_LINE);
      const fix = firstOf(item, F_FIX);

      const card = el("li", "finding tone-" + toneForWord(sev));

      const head = el("div", "finding-head");
      if (sev) head.appendChild(el("span", "sev-pill tone-" + toneForWord(sev), sev));
      head.appendChild(el("span", "finding-title", title || "Finding " + (i + 1)));
      card.appendChild(head);

      if (file) {
        card.appendChild(el("span", "finding-loc", String(file) + (has(line) ? ":" + line : "")));
      }
      if (body) card.appendChild(el("p", "finding-body", body));

      if (fix) {
        const fixEl = el("p", "finding-fix");
        fixEl.appendChild(el("strong", null, "Suggested fix: "));
        fixEl.appendChild(document.createTextNode(String(fix)));
        card.appendChild(fixEl);
      }

      // Unrecognised field names: show the object rather than drop it.
      if (!sev && !title && !body && !file && !fix) {
        card.appendChild(el("pre", "raw-json", JSON.stringify(item, null, 2)));
      }
      list.appendChild(card);
    });

    return list;
  }

  /* ---------------------------------------------------------------
     Recommended tests
     --------------------------------------------------------------- */

  const T_TYPE = ["test_type", "type", "level", "category", "kind"];
  const T_SCENARIO = ["scenario", "title", "name", "test", "case", "description", "summary"];
  const T_EXPECT = ["expected_result", "expected", "expectation", "outcome", "result"];

  function buildTests(items) {
    const list = el("ul", "tests-list");

    items.forEach(function (item, i) {
      const card = el("li", "test-item");
      const head = el("div", "test-head");
      head.appendChild(el("span", "test-index", i + 1));

      if (typeof item !== "object" || item === null) {
        head.appendChild(el("span", "test-scenario-inline", String(item)));
        card.appendChild(head);
        list.appendChild(card);
        return;
      }

      const type = firstOf(item, T_TYPE);
      const scenario = firstOf(item, T_SCENARIO);
      const expected = firstOf(item, T_EXPECT);

      if (type) head.appendChild(el("span", "type-pill", type));
      card.appendChild(head);

      if (scenario) {
        card.appendChild(el("p", "test-scenario", Array.isArray(scenario) ? scenario.join(" ") : scenario));
      }
      if (expected) {
        const exp = el("p", "test-expected");
        exp.appendChild(el("strong", null, "Expected: "));
        exp.appendChild(document.createTextNode(
          Array.isArray(expected) ? expected.join(" ") : String(expected)
        ));
        card.appendChild(exp);
      }
      if (!type && !scenario && !expected) {
        card.appendChild(el("pre", "raw-json", JSON.stringify(item, null, 2)));
      }
      list.appendChild(card);
    });

    return list;
  }

  /* ---------------------------------------------------------------
     Improvement summary
     --------------------------------------------------------------- */

  function buildActionList(items, tone) {
    const list = el("ul", "action-list tone-" + tone);
    items.forEach(function (entry) {
      const li = el("li", "action-item");
      if (typeof entry === "object" && entry !== null) {
        const label = firstOf(entry, ["title", "action", "fix", "description", "summary", "text", "note"]);
        li.textContent = label ? String(label) : JSON.stringify(entry);
      } else {
        li.textContent = String(entry);
      }
      list.appendChild(li);
    });
    return list;
  }

  function buildImprovementGroup(label, items, tone, emptyText) {
    const group = el("div", "improve-group");
    const head = el("div", "improve-group-head");
    head.appendChild(el("span", "improve-label", label));
    head.appendChild(el("span", "improve-count tone-" + (items.length ? tone : "clear"), items.length));
    group.appendChild(head);

    if (items.length) {
      group.appendChild(buildActionList(items, tone));
    } else {
      group.appendChild(el("p", "improve-empty", emptyText));
    }
    return group;
  }

  function buildImprovementSummary(summary) {
    const wrap = el("div", "improve-body");

    if (typeof summary === "string") {
      wrap.appendChild(el("p", "improve-note", summary));
      return wrap;
    }
    if (Array.isArray(summary)) {
      wrap.appendChild(buildActionList(summary, "fair"));
      return wrap;
    }
    if (!summary || typeof summary !== "object") return wrap;

    const priority = Array.isArray(summary.priority_fixes) ? summary.priority_fixes : [];
    const blocking = Array.isArray(summary.release_blocking) ? summary.release_blocking : [];
    const note = firstOf(summary, ["note", "notes", "summary", "comment", "conclusion"]);

    const grid = el("div", "improve-grid");
    grid.appendChild(buildImprovementGroup("Priority Fixes", priority, "fair", "Nothing flagged as a priority fix."));
    grid.appendChild(buildImprovementGroup("Release Blocking", blocking, "poor", "Nothing blocking release."));
    wrap.appendChild(grid);

    if (note) wrap.appendChild(el("p", "improve-note", note));

    // Any extra keys the workflow adds beyond the three known ones.
    Object.keys(summary).forEach(function (k) {
      if (["priority_fixes", "release_blocking", "note", "notes", "summary", "comment", "conclusion"].indexOf(k) > -1) return;
      const v = summary[k];
      if (!has(v)) return;
      const extra = el("p", "improve-extra");
      extra.appendChild(el("strong", null, k.replace(/_/g, " ") + ": "));
      extra.appendChild(document.createTextNode(
        typeof v === "object" ? JSON.stringify(v) : String(v)
      ));
      wrap.appendChild(extra);
    });

    return wrap;
  }

  /* ---------------------------------------------------------------
     Report assembly
     --------------------------------------------------------------- */

  function buildReportHeader(root, files) {
    const head = el("header", "report-head");

    const idBlock = el("div", "report-id");
    if (has(root.repo)) idBlock.appendChild(el("span", "repo-name", root.repo));

    const meta = el("div", "report-meta");
    if (has(root.branch)) meta.appendChild(el("span", "branch-pill", root.branch));
    if (has(root.files_reviewed)) {
      const n = Number(root.files_reviewed);
      meta.appendChild(el("span", "meta-chip",
        root.files_reviewed + (n === 1 ? " file reviewed" : " files reviewed")));
    }
    if (meta.childNodes.length) idBlock.appendChild(meta);
    if (idBlock.childNodes.length) head.appendChild(idBlock);

    // Aggregate score, plus the rating when a single file makes it unambiguous.
    const score = has(root.overall_score) ? root.overall_score
                                          : (files[0] ? files[0].overall_score : null);
    if (has(score)) {
      const scoreWrap = buildScoreGauge(score, Number(score) <= 10 ? 10 : 100);
      if (files.length === 1 && files[0] && has(files[0].overall_rating)) {
        scoreWrap.appendChild(
          el("span", "rating-pill tone-" + toneForWord(files[0].overall_rating), files[0].overall_rating)
        );
      }
      head.appendChild(scoreWrap);
    }

    return head.childNodes.length ? head : null;
  }

  function buildFileBlock(f, showScore) {
    const block = el("article", "file-block");

    const head = el("div", "file-head");
    if (has(f.file)) head.appendChild(el("span", "file-path", f.file));
    if (has(f.overall_rating) && showScore) {
      head.appendChild(el("span", "rating-pill tone-" + toneForWord(f.overall_rating), f.overall_rating));
    }
    if (has(f.overall_score) && showScore) {
      head.appendChild(el("span", "file-score", f.overall_score + "/" + (Number(f.overall_score) <= 10 ? 10 : 100)));
    }
    if (head.childNodes.length) block.appendChild(head);

    const scorecard = Array.isArray(f.scorecard) ? f.scorecard : [];
    if (scorecard.length) {
      block.appendChild(buildSection("Scorecard", scorecard.length, buildScorecard(scorecard)));
    }

    const findings = Array.isArray(f.findings) ? f.findings : [];
    block.appendChild(buildSection(
      "Findings",
      findings.length,
      findings.length ? buildFindings(findings)
                      : buildEmptyNote("No findings in the reviewed scope.")
    ));

    const tests = Array.isArray(f.recommended_tests) ? f.recommended_tests : [];
    if (tests.length) {
      block.appendChild(buildSection("Recommended Tests", tests.length, buildTests(tests)));
    }

    if (has(f.improvement_summary)) {
      block.appendChild(buildSection("Improvement Summary", null, buildImprovementSummary(f.improvement_summary)));
    }

    return block;
  }

  function renderReport(root) {
    resetPanel();
    resultBody.classList.add("has-report");

    const report = el("div", "review-report");
    const files = Array.isArray(root.files) && root.files.length ? root.files : [root];

    const header = buildReportHeader(root, files);
    if (header) report.appendChild(header);

    // With one file the score already sits in the header; with several,
    // each block carries its own.
    const showPerFileScore = files.length > 1;
    files.forEach(function (f) {
      if (f && typeof f === "object") report.appendChild(buildFileBlock(f, showPerFileScore));
    });

    if (!report.childNodes.length) {
      report.appendChild(el("p", "improve-note", "The reviewer returned an empty report."));
    }

    resultBody.appendChild(report);
  }

  function renderPlainReview(text) {
    resetPanel();
    resultBody.classList.add("has-report");
    const pre = el("pre", "review-text");
    pre.textContent = text;
    resultBody.appendChild(pre);
  }

  /* ---------------------------------------------------------------
     Request
     --------------------------------------------------------------- */

  async function handleReview() {
    const url = repoInput.value.trim();
    repoInput.classList.remove("input-error");

    if (!url) {
      repoInput.classList.add("input-error");
      setValidationMessage("Please enter a GitHub file or repository URL before starting a review.");
      repoCard.classList.remove("shake");
      void repoCard.offsetWidth;
      repoCard.classList.add("shake");
      return;
    }

    const originalLabel = reviewBtn.textContent;
    reviewBtn.disabled = true;
    repoInput.disabled = true;
    reviewBtn.textContent = "Reviewing...";
    setLoadingState();

    try {
      // samplereviewer1 is registered for GET, so the link travels as a
      // query parameter. Switch back to a POST body if the node changes.
      const endpoint = new URL(WEBHOOK_URL);
      endpoint.searchParams.set("githubUrl", url);
      endpoint.searchParams.set("repoUrl", url);
      endpoint.searchParams.set("url", url);

      const response = await fetch(endpoint, { method: "GET" });

      if (!response.ok) {
        throw new Error("Server responded with status " + response.status);
      }

      // Read as text first: a 200 with an empty body would make
      // response.json() throw and look like a connection failure.
      const rawText = await response.text();
      if (!rawText.trim()) {
        setErrorState(
          "The workflow replied with an empty response. Check that the Respond to Webhook node returns the review JSON."
        );
        return;
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        data = rawText;
      }

      const payload = unwrapPayload(data);
      if (isReviewReport(payload)) {
        renderReport(payload);
      } else {
        renderPlainReview(extractReviewText(data));
      }
    } catch (err) {
      console.error("Code review request failed:", err);
      setErrorState(
        "Something went wrong while contacting the AI reviewer. Please confirm the n8n workflow is active and try again."
      );
    } finally {
      reviewBtn.disabled = false;
      repoInput.disabled = false;
      reviewBtn.textContent = originalLabel;
    }
  }

  reviewBtn.addEventListener("click", handleReview);
  repoInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleReview();
    }
  });
  repoInput.addEventListener("input", function () {
    repoInput.classList.remove("input-error");
  });

  setWaitingState();
})();
