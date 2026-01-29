# jobshub task management automation

## Overview
Minimal Netlify project that provides:
- A simple HTTPS page for Trello Power-Up Iframe connector (shows "OK").
- A secure webhook to create Trello cards by board name + list (column) name.
- Optional due date, labels, and checklist items.
- Helper endpoint to list boards/lists for setup.

## Setup
### 1) Get Trello API key and token
1. Create or use an existing Trello account.
2. Get your API key: open the Trello developer API key page (search "Trello API key") and copy the key.
3. Create a token for your account using the same page (it provides a token link).

### 2) Environment variables (Netlify)
Set these in Netlify site settings > Environment variables:

Required:
- `TRELLO_KEY`
- `TRELLO_TOKEN`
- `WEBHOOK_SECRET`
- `DEFAULT_BOARD_NAME` (recommended)
- `DEFAULT_LIST_NAME` (recommended)

Optional:
- `DEFAULT_BOARD_ID` (if you prefer ID lookup instead of name)
- `ALLOW_LABEL_CREATE` (`true` or `false`)
- `RATE_LIMIT_PER_MINUTE` (integer, best-effort in-memory rate limit)

## Deploy
### Netlify UI
1. Push this repo to GitHub (or similar).
2. Create a new Netlify site and connect the repo.
3. Build settings are automatic (functions in `netlify/functions`).
4. Set environment variables, deploy.

### Netlify CLI (optional)
1. `npm i -g netlify-cli`
2. `netlify login`
3. `netlify init` and follow prompts

## Endpoints
- `POST /.netlify/functions/trello-create-card`
- `GET /.netlify/functions/trello-meta`

Both require `x-webhook-secret` header matching `WEBHOOK_SECRET`.

## API: Create Card
Request JSON:
```json
{
  "boardName": "JobHub",
  "listName": "To Do",
  "name": "Fix checkout bug",
  "desc": "Steps to reproduce...",
  "due": "2026-02-02T10:00:00+08:00",
  "labels": ["bug", "backend"],
  "checklist": ["Reproduce", "Fix", "Test", "Deploy"]
}
```

Response JSON:
```json
{
  "ok": true,
  "card": { "id": "...", "name": "...", "shortUrl": "..." },
  "resolved": { "boardName": "...", "listName": "..." }
}
```

## API: Meta (boards/lists)
`GET /.netlify/functions/trello-meta`

Optional query params:
- `boardName`
- `boardId`

Returns boards and, if a board is specified, its lists.

## cURL examples
Replace `YOUR_SECRET` and your Netlify site URL.

Create card with boardName/listName:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/trello-create-card \
  -H "content-type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "boardName": "JobHub",
    "listName": "To Do",
    "name": "Fix checkout bug",
    "desc": "Steps to reproduce..."
  }'
```

Create card using defaults:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/trello-create-card \
  -H "content-type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "name": "Add monitoring",
    "desc": "Add uptime alerts"
  }'
```

Create card with labels + checklist + due date:
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/trello-create-card \
  -H "content-type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "boardName": "JobHub",
    "listName": "To Do",
    "name": "Release v2",
    "desc": "Launch checklist",
    "due": "2026-02-02T10:00:00+08:00",
    "labels": ["release"],
    "checklist": ["QA", "Docs", "Deploy"]
  }'
```

Meta endpoint (boards and lists):
```bash
curl -X GET "https://YOUR_SITE.netlify.app/.netlify/functions/trello-meta?boardName=JobHub" \
  -H "x-webhook-secret: YOUR_SECRET"
```

## Security notes
- Never expose `TRELLO_TOKEN` or `TRELLO_KEY` in client-side code.
- Always call these endpoints server-to-server or via a secure action with the secret header.

## Notes for ChatGPT Action
- Endpoint: `POST /.netlify/functions/trello-create-card`
- Required header: `x-webhook-secret: <WEBHOOK_SECRET>`
- JSON body schema:
```json
{
  "boardName": "string (optional if DEFAULT_BOARD_NAME set)",
  "listName": "string (optional if DEFAULT_LIST_NAME set)",
  "name": "string (required)",
  "desc": "string (optional)",
  "due": "string ISO8601 (optional)",
  "labels": ["string"],
  "checklist": ["string"]
}
```
