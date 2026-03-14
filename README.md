# AI Browser Agent

Autonomous AI agent that controls a web browser to perform complex multi-step tasks.

## Features

- **Visible browser** — watch the agent work in real-time
- **Persistent sessions** — log in manually, agent continues working
- **DOM Sub-agent** — intelligent page analysis without sending full HTML to LLM
- **Security layer** — confirms before destructive actions (payments, deletions)
- **Context management** — automatic conversation compression to stay within token limits
- **Error recovery** — retries with alternative approaches on failures

## Setup

1. Install dependencies:
```bash
npm install
npx playwright install chromium
```

2. Configure `.env`:
```
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
MODEL_NAME=claude-sonnet-4-20250514
SUB_AGENT_MODEL=claude-haiku-4-20250514
```

3. Run:
```bash
npm run dev
```

## Usage

A browser window and terminal chat will open. Type your task in the terminal:

```
You: открой яндекс лавку, найди хот-дог и добавь в корзину
You: зайди на hh.ru и найди вакансии AI-инженера в Москве
You: открой gmail, прочитай последние 5 писем и удали спам
```

### Commands
- `reset` — clear conversation history
- `exit` — close the agent

## Architecture

```
Terminal UI ←→ Main Agent (Claude + Tool Calling) ←→ Browser (Playwright)
                        ↓
                  DOM Sub-agent (page analysis)
                        ↓
                  Security Guard (destructive action confirmation)
```

### Tools
| Tool | Description |
|------|-------------|
| `navigate_to_url` | Go to URL |
| `click_element` | Click element by CSS selector |
| `type_text` | Type text into input field |
| `press_key` | Press keyboard key |
| `take_screenshot` | Capture page screenshot |
| `query_dom` | Ask DOM sub-agent about page content |
| `scroll_page` | Scroll up/down |
| `wait` | Wait N seconds |
| `go_back` | Navigate back |
| `hover_element` | Hover over element |
| `ask_user` | Ask user for input |

## Tech Stack

- TypeScript / Node.js
- Playwright (browser automation)
- Anthropic Claude API (via z.ai proxy)
- Tool calling / function calling pattern
