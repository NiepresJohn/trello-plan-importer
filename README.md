# 🚀 Trello Plan Importer

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Trello API](https://img.shields.io/badge/Trello-API-0079BF?style=for-the-badge&logo=trello&logoColor=white)](https://developer.atlassian.com/cloud/trello/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

**Transform LLM-generated project plans into organized Trello boards instantly**

[Demo](https://your-demo-url.com) · [Report Bug](../../issues) · [Request Feature](../../issues)

![Preview](https://via.placeholder.com/800x400/f7f2e9/1b1b1b?text=Trello+Plan+Importer+Preview)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Trello API Setup](#trello-api-setup)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Usage](#-usage)
  - [Generate a Plan](#1-generate-a-plan)
  - [Import & Review](#2-import--review)
  - [Commit to Trello](#3-commit-to-trello)
- [JSON Format](#-json-format)
  - [Simple Format](#simple-format)
  - [Board Format](#board-format)
  - [Field Reference](#field-reference)
- [Architecture](#-architecture)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [API Routes](#api-routes)
- [Security](#-security)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Changelog](#-changelog)

---

## 🌟 Overview

Trello Plan Importer bridges the gap between AI planning and project execution. Paste a JSON plan from ChatGPT, Claude, Gemini, or any LLM, review and edit it in the built-in editor, and deploy it to Trello with one click.

Whether you're breaking down a sprint, organizing a product launch, or structuring a personal project, this tool turns abstract plans into actionable Trello boards—complete with cards, labels, checklists, and due dates.

### Why This Tool?

| Before | After |
|--------|-------|
| Copy-paste LLM output into Trello manually | One-click deployment with full review |
| Lose structure and context | Preserved hierarchy with labels and checklists |
| No way to validate before committing | Visual editor with validation |
| Repetitive manual card creation | Batch import with concurrency |

---

## ✨ Features

### 🤖 LLM Integration
- **Multi-provider support** — OpenAI, Anthropic Claude, Google Gemini
- **Built-in AI generation** — Create plans directly in the app
- **Smart parsing** — Handles multiple JSON formats automatically

### 📝 Draft Editor
- **Visual card editor** — Edit titles, descriptions, due dates
- **Label management** — Add/remove labels with color support
- **Checklists** — Break cards into actionable subtasks
- **Draft persistence** — Auto-save to localStorage with 7-day expiry warning

### 🔄 Trello Deployment
- **One-click commit** — Deploy entire boards instantly
- **Replace mode** — Archive old lists and create fresh ones
- **Progress tracking** — Real-time results with per-card status
- **Concurrent processing** — Creates cards 5x faster with parallel API calls

### 🛡️ Security
- **Server-side credentials** — Trello keys never exposed to client
- **Webhook authentication** — Optional secret validation with timing-safe comparison
- **Rate limiting** — Sliding-window protection against abuse
- **Input validation** — Strict limits on payload size and content

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ installed
- [Git](https://git-scm.com) for cloning
- A [Trello](https://trello.com) account

### Trello API Setup

You'll need two credentials from Trello:

#### 1. API Key

1. Go to https://trello.com/app-key
2. Copy your **API Key** (top of page)

#### 2. Token

1. On the same page, click **"Token"** link
2. Authorize the application
3. Copy your **Token**

> ⚠️ **Important:** Your token grants full access to your Trello account. Keep it secret!

#### 3. Webhook Secret

Generate a secure random string (32+ characters):

```bash
openssl rand -hex 32
```

### Installation

```bash
# Clone the repository
git clone https://github.com/NiepresJohn/trello-plan-importer.git
cd trello-plan-importer

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

Edit `.env.local`:

```env
# ─── Required ───────────────────────────────────
TRELLO_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token
WEBHOOK_SECRET=your_32_char_random_secret

# ─── Recommended ────────────────────────────────
DEFAULT_BOARD_NAME=My Project Board
DEFAULT_LIST_NAME=To Do

# ─── Optional ───────────────────────────────────
DEFAULT_BOARD_ID=              # Specific board ID (skips name lookup)
ALLOW_BOARD_CREATE=true        # Allow creating new boards
ALLOW_LABEL_CREATE=true        # Allow creating new labels
RATE_LIMIT_PER_MINUTE=30       # API rate limit
DEFAULT_LLM_PROVIDER=openai    # Default LLM for AI generation
```

#### Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRELLO_KEY` | ✅ | — | Trello API key |
| `TRELLO_TOKEN` | ✅ | — | Trello OAuth token |
| `WEBHOOK_SECRET` | ✅ | — | Random 32+ char string |
| `DEFAULT_BOARD_NAME` | — | — | Fallback board name |
| `DEFAULT_LIST_NAME` | — | `"To Do"` | Fallback list name |
| `DEFAULT_BOARD_ID` | — | — | Target specific board |
| `ALLOW_BOARD_CREATE` | — | `true` | Allow board creation |
| `ALLOW_LABEL_CREATE` | — | `true` | Allow label creation |
| `RATE_LIMIT_PER_MINUTE` | — | `30` | Max requests per minute |

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📘 Usage

### 1. Generate a Plan

**Option A: Use Built-in AI**

1. Select your LLM provider (OpenAI, Anthropic, Google)
2. Enter your API key (stored in sessionStorage)
3. Describe your project in plain text
4. Click **"Generate Plan with AI"**

**Option B: Paste Existing JSON**

1. Switch to **"Paste JSON"** tab
2. Paste your plan JSON (see [JSON Format](#-json-format))
3. Click **"Load JSON plan"**

### 2. Import & Review

After importing, you'll see:

- **Board selector** — Choose existing or create new
- **Replace mode** — Toggle to archive existing lists
- **Draft controls** — Save, restore, or reset drafts

Navigate to **Step 3** to review individual cards:

- ✏️ Edit titles and descriptions
- 📅 Set due dates
- 🏷️ Add/remove labels
- ✅ Create checklists
- 🗑️ Delete cards

### 3. Commit to Trello

1. Click **"Commit to Trello"**
2. Review the confirmation modal
3. Confirm to deploy
4. Watch real-time progress
5. Click card links to view in Trello

---

## 📋 JSON Format

The importer accepts multiple JSON structures. It automatically normalizes variations.

### Simple Format

Best for flat lists of tasks:

```json
{
  "boardName": "Website Redesign",
  "listName": "To Do",
  "items": [
    {
      "name": "Design homepage mockup",
      "desc": "Create 3 variations for A/B testing",
      "due": "2026-03-15T17:00:00Z",
      "labels": ["P0", "Design"],
      "checklist": ["Sketch wireframes", "Get feedback", "Finalize design"]
    },
    {
      "name": "Set up CI/CD pipeline",
      "desc": "Automated testing and deployment",
      "labels": ["P1", "DevOps"]
    }
  ]
}
```

### Board Format

For multi-list boards with existing labels:

```json
{
  "board": {
    "name": "Mobile App Launch",
    "labels": [
      { "id": "l1", "name": "P0", "color": "red" },
      { "id": "l2", "name": "P1", "color": "orange" }
    ],
    "lists": [
      {
        "name": "Backlog",
        "cards": [
          { "title": "Research competitors", "description": "Analyze top 5 apps", "labelIds": ["l1"] }
        ]
      },
      {
        "name": "In Progress",
        "cards": [
          { "title": "Build auth flow", "description": "Login, signup, reset password", "labels": ["P0", "Feature"] }
        ]
      }
    ]
  }
}
```

### Field Reference

#### Plan Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Card title (max 500 chars) |
| `desc` | string | — | Card description (max 5000 chars) |
| `due` | string | — | ISO 8601 date (e.g., `2026-03-15T17:00:00Z`) |
| `labels` | array | — | Label names or `{ name, color }` objects (max 10) |
| `checklist` | array | — | Subtask strings (max 50) |
| `listName` | string | — | Override list for this card |

#### Label Colors

Available colors: `yellow`, `purple`, `blue`, `red`, `green`, `orange`, `black`, `sky`, `pink`, `lime`

#### Alternative Field Names

These are automatically normalized:

| Input | Normalized To |
|-------|---------------|
| `card.title` | `card.name` |
| `card.description` | `card.desc` |
| `board.columns` | `board.lists` |
| `board.tasks` | `board.items` |
| `column.name` | `column.title` |

---

## 🏗️ Architecture

### Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/) (strict mode)
- **UI:** [React 18](https://react.dev/) with custom hooks
- **Styling:** Plain CSS with CSS variables (light/dark mode)
- **APIs:** Trello REST API, OpenAI, Anthropic, Google Gemini

### Project Structure

```
trello-plan-importer/
├── app/
│   ├── api/
│   │   ├── llm/generate/route.ts    # LLM plan generation
│   │   └── trello/
│   │       ├── commit/route.ts      # Create/update boards
│   │       └── meta/route.ts        # Fetch boards & lists
│   ├── components/
│   │   ├── TaskPlanner.tsx          # Main 4-step workflow
│   │   ├── LLMPlanner.tsx           # AI generation UI
│   │   ├── Stepper.tsx              # Step navigation
│   │   ├── LabelEditor.tsx          # Label management
│   │   └── ChecklistEditor.tsx      # Checklist management
│   ├── hooks/
│   │   ├── useDraftPlan.ts          # Draft state + persistence
│   │   ├── useTrelloMeta.ts         # Board/list fetching
│   │   └── useCommit.ts             # Commit logic
│   ├── lib/
│   │   ├── auth.ts                  # Webhook validation
│   │   ├── llm.ts                   # Multi-provider LLM client
│   │   ├── plan.ts                  # Plan validation
│   │   ├── rateLimit.ts             # Rate limiting
│   │   └── trello.ts                # Trello API client
│   ├── globals.css                  # Styles + CSS variables
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Home page
├── .env.example                     # Environment template
├── next.config.js
├── tsconfig.json
└── package.json
```

### API Routes

#### `GET /api/trello/meta`

Fetch boards and optional lists.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boardName` | string | Filter by board name |
| `boardId` | string | Get lists for specific board |

**Response:**
```json
{
  "ok": true,
  "boards": [{ "id": "abc123", "name": "My Board" }],
  "lists": [{ "id": "def456", "name": "To Do" }],
  "resolvedBoard": { "id": "abc123", "name": "My Board" }
}
```

#### `POST /api/trello/commit`

Create or update a Trello board.

**Request:**
```json
{
  "plan": {
    "boardName": "My Project",
    "listName": "To Do",
    "items": [{ "name": "Task 1", "desc": "Description" }]
  },
  "replace": false
}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "ok": true,
      "name": "Task 1",
      "listName": "To Do",
      "shortUrl": "https://trello.com/c/xyz789",
      "warnings": []
    }
  ]
}
```

#### `POST /api/llm/generate`

Generate a plan via LLM.

**Request:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini",
  "description": "Build a todo app"
}
```

**Supported Models:**

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo |
| Anthropic | claude-3-5-haiku-latest, claude-3-5-sonnet-latest, claude-3-opus-latest |
| Google | gemini-1.5-flash, gemini-1.5-pro, gemini-1.0-pro |

---

## 🔒 Security

### Credential Protection

- ✅ Trello credentials are **server-only** — never sent to client
- ✅ LLM API keys use **sessionStorage** (cleared on tab close)
- ✅ Error messages are **sanitized** — no internal details leaked
- ✅ Webhook secrets use **timing-safe comparison** (prevents timing attacks)

### Rate Limiting

Sliding-window rate limiter (default: 30 req/min):

```env
RATE_LIMIT_PER_MINUTE=30
```

> Note: In-memory only. For production deployments behind a load balancer, consider Redis-based rate limiting.

### Input Validation

- Max 100 items per plan
- Max 500 characters per card name
- Max 5000 characters per description
- Max 10 labels per item
- Max 50 checklist items per card

### Request Timeouts

- Trello API: 30 seconds
- LLM API: 60 seconds

---

## 🚢 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/NiepresJohn/trello-plan-importer)

1. Import your GitHub repository
2. Add environment variables in dashboard
3. Deploy

### Docker

```bash
# Build image
docker build -t trello-plan-importer .

# Run container
docker run -p 3000:3000 \
  -e TRELLO_KEY=xxx \
  -e TRELLO_TOKEN=xxx \
  -e WEBHOOK_SECRET=xxx \
  trello-plan-importer
```

### Self-Hosted

```bash
npm run build
npm start
```

---

## 🔧 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Invalid API key or token" | Regenerate at https://trello.com/app-key and restart server |
| "Board not found" | Check name spelling or use `DEFAULT_BOARD_ID` |
| "Too many requests" | Wait 60 seconds or increase `RATE_LIMIT_PER_MINUTE` |
| "Request timeout" | Check network connection; Trello API may be slow |
| "Failed to parse LLM response" | AI returned invalid JSON—try regenerating |
| Labels not created | Set `ALLOW_LABEL_CREATE=true` |
| Cards in wrong list | Ensure `listName` is set per item or globally |

### Debug Mode

Enable verbose logging:

```bash
NODE_ENV=development npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style (TypeScript strict mode)
- Keep components small and focused
- Add JSDoc comments for public APIs
- Test your changes with `npm run build`

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

---

## 📝 Changelog

### v1.1.0 (2026-09-03)

**Security**
- Fixed timing attack vulnerability in webhook authentication
- Added request timeouts to all external API calls
- Sanitized error messages to prevent information leakage
- Moved LLM API keys from localStorage to sessionStorage

**Reliability**
- Fixed memory leak in rate limiter with automatic cleanup
- Added concurrent card creation (5x faster deployments)
- Fixed silent failures in label and checklist operations
- Improved LLM response parsing with proper error handling

**Architecture**
- Refactored 1008-line god component into focused modules
- Extracted reusable custom hooks
- Added comprehensive input validation with limits

### v1.0.0 (2026-02-02)
- Initial release
- Next.js App Router implementation
- Draft editor with card management
- One-click Trello board creation
- Replace mode for existing boards
- Multi-provider LLM integration

---

<div align="center">

Made with ❤️ by [NiepresJohn](https://github.com/NiepresJohn)

[⬆ Back to Top](#-trello-plan-importer)

</div>
