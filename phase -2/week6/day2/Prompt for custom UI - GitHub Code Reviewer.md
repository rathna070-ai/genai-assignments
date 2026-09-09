# Prompt for Custom UI — AI GitHub Code Reviewer

## Organization Branding Reference

Use this identity consistently across every phase (swap these values for your own organization's real branding if you have one — everything below is a placeholder identity for this build):

- **Product name:** CodeSentinel AI
- **Organization:** Sentinel Labs
- **Tagline:** "AI-powered code reviews, before your team ever sees the diff."
- **Logo concept:** A rounded shield icon with a `</>` code bracket glyph inside it, in a soft glowing gradient.
- **Color palette:**
  - Background: deep charcoal-to-graphite gradient (`#0d1117` → `#161b22`, GitHub-dark inspired)
  - Primary brand accent: indigo/violet (`#6366f1` → `#8b5cf6`)
  - Success / quality signal: emerald green (`#10b981`)
  - Warning: amber (`#f59e0b`)
  - Error: red (`#ef4444`)
  - Primary text: off-white (`#e6edf3`); muted text: slate gray (`#8b949e`)
- **Typography:** "Space Grotesk" or "Sora" for headings, "Inter" for body text, "JetBrains Mono" for code snippets.

---

## Phase 1 — Build the Complete UI

I am building an AI-powered GitHub Code Reviewer application called **CodeSentinel AI**, by Sentinel Labs.

Please create a beautiful and professional user interface for this application.

The application should feel modern, premium, and attractive, giving users a great experience when they open it — it should look like a real AI developer-tools product, not a plain web page.

Create the UI for the following requirement:

1. A UI page where I can send a request to n8n and get the output on the same UI.
2. A connection point with n8n to receive requests from the UI and send responses back to the UI.

At this stage, only create the HTML structure and CSS styling. Do not write any JavaScript functionality.

The page should include:

- A beautiful header with the CodeSentinel AI logo (shield + code-bracket icon) and organization name "Sentinel Labs".
- Application title: **CodeSentinel AI — GitHub Code Reviewer**
- A short description explaining that this application reviews source code from a GitHub file or repository using Artificial Intelligence, checking for bugs, code quality, best practices, and security issues.
- A large input box where users can enter a **GitHub File URL** (e.g. `https://raw.githubusercontent.com/org/repo/main/File.java`).
- A modern **Review Code** button.
- A **Review Result** section, styled like a code-review report card, where the AI review will appear later.
- A professional footer with the organization name, a copyright line, and placeholder links (e.g. Docs, GitHub, Contact).

Initially display in the Review Result section:

> Waiting for review...

Use a premium developer-tools look and feel, in the CodeSentinel AI color palette (deep charcoal/graphite background, indigo-violet accents, emerald for quality/success signals).

The UI should have:

- Soft gradient background
- Glassmorphism cards
- Rounded corners
- Smooth shadows
- Attractive, developer-friendly fonts (headings vs. body vs. code font, as above)
- Professional spacing
- Nice hover effects
- Modern buttons
- Responsive layout

Do not use Bootstrap or Tailwind.

The design should look like a real AI SaaS product for developers, not a simple web page.

---

## Phase 2 — Connect the UI with n8n

The UI is already completed.

Now connect it with my n8n backend.

When the user enters a GitHub File URL and clicks the **Review Code** button:

- Read the entered GitHub File URL.
- Send it to my n8n Webhook.
- Wait for the response.
- Display a loading message while the review is being generated.
- Once the response is received, display the AI code review inside the Review Result section.

If no GitHub File URL is entered, show a friendly validation message asking the user to enter one.

Keep the existing UI unchanged. Only add the functionality required to communicate with the webhook.

---

## Phase 3 — Improve the User Experience

The application is working correctly.

Now improve the user experience. Make the application feel like a modern AI developer product.

Please add:

- An attractive loading animation while waiting for the AI code review (e.g. a scanning-line or "analyzing code" effect).
- Better button effects.
- Better spacing.
- Smooth animations.
- Nice transitions.
- A success message after the review is completed.
- A friendly error message if something goes wrong (e.g. invalid URL, webhook unreachable).
- Improve the overall appearance while keeping the existing layout.

Do not change the backend integration. Focus only on improving the overall user experience.

---

## Phase 4 — Create a Premium Commercial Product Experience

Now make the application look like a premium commercial AI product from Sentinel Labs.

Enhance the design without changing the existing functionality.

Please improve the application by adding:

- Beautiful gradient background
- Animated CodeSentinel AI logo
- Modern navigation bar with the organization name and simple nav links (e.g. Dashboard, Docs, History)
- Premium cards
- Attractive icons throughout (code, shield, checkmark, warning icons for review findings)
- Stylish buttons
- Elegant typography
- Smooth animations
- Professional color theme (the CodeSentinel AI palette above)
- Responsive design for mobile, tablet, and desktop
- A polished AI dashboard appearance
- A refined, branded footer

The final result should make users feel they are using a real AI SaaS application built by a professional organization.

Do not change the workflow or backend. Only enhance the design and user experience.
