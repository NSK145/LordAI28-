# ⚡ LORD AI

<div align="center">

![LORD Banner](https://img.shields.io/badge/LORD-AI%20OS-00D4FF?style=for-the-badge)

### Logical Operational Resource Director

**A Next-Generation AI**

[![React](https://img.shields.io/badge/React-19-blue?style=flat-square)](<>)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](<>)
[![TanStack Router](https://img.shields.io/badge/TanStack-Router-orange?style=flat-square)](<>)
[![Vite](https://img.shields.io/badge/Vite-Latest-purple?style=flat-square)](<>)
[![AI SDK](https://img.shields.io/badge/AI-SDK-green?style=flat-square)](<>)

---

### 🧠 Your Personal AI

_Not just a chatbot. An intelligent command center._

</div>

---

# 🚀 Overview

LORD (Logical Operational Resource Director) is a futuristic AI designed to provide an immersive, intelligent, and highly interactive assistant experience.

Built with a cyberpunk-inspired HUD interface, LORD combines:

- 💬 Persistent AI Conversations
- 🎙️ Voice Command Infrastructure
- 🧠 Long-Term Memory Systems
- 📊 Real-Time System Monitoring
- 🧠 Study tutor
- ⚡ Multi-Mode Intelligence Engine
- 🎯 Workflow Assistance
- 🔍 Research & Knowledge Operations

into a single unified experience.

---

# ✨ Core Features

## 🧠 AI Intelligence Engine

LORD supports multiple specialized reasoning modes:

| Mode         | Purpose              |
| ------------ | -------------------- |
| ⚡ Fast      | Quick answers        |
| ⚖️ Balanced  | Everyday assistant   |
| 🧠 Reasoning | Deep analysis        |
| 💻 Coding    | Software engineering |
| 🎨 Creative  | Writing & ideation   |

---

## 💬 Persistent Conversations

Unlike traditional chat interfaces:

✅ Conversations are saved automatically

✅ Chat history persists across sessions

✅ Previous chats can be reopened instantly

✅ Local-first architecture

```text
Conversation
 ├── Messages
 ├── Metadata
 ├── Timestamps
 └── Context Memory
```

---

## 📡 System Intelligence Dashboard

Real-time operational monitoring:

- API Health
- Database Status
- Authentication Status
- Latency Monitoring
- Uptime Tracking
- Error Detection
- Route Awareness

Designed to feel like a true AI command center.

---

## 🎙️ Voice Interface

Current & Planned Capabilities:

### Current

- Voice UI
- Transcript Display
- AI Response Panel

### Roadmap

- Wake Word Detection
- Speech Recognition
- Text-To-Speech
- Continuous Listening
- Voice Profiles

Example:

```text
User:
"Hey Lord"

LORD:
Listening...

User:
"Summarize today's tasks."

LORD:
Processing...

LORD:
Here is your task summary...
```

---

## 🧠 Memory System

LORD is being designed to remember:

- Preferences
- Goals
- Projects
- Facts
- Notes

Example:

```text
Remember that I am preparing for JEE.

Weeks later...

User:
What should I focus on today?

LORD:
Based on your JEE preparation...
```

---

# 🏗 Architecture

```text
┌──────────────────────────┐
│      LORD AI OS          │
└────────────┬─────────────┘
             │
             ▼

 ┌─────────────────────┐
 │   React Frontend    │
 └─────────────────────┘
             │
             ▼

 ┌─────────────────────┐
 │ AI SDK Integration  │
 └─────────────────────┘
             │
             ▼

 ┌─────────────────────┐
 │ Chat Intelligence   │
 └─────────────────────┘
             │
             ▼

 ┌─────────────────────┐
 │ Memory + Storage    │
 └─────────────────────┘
```

---

# 🖥 User Interface

Inspired by:

- J.A.R.V.I.S
- F.R.I.D.A.Y
- Iron Man HUD Systems
- Cyberpunk Tactical Interfaces

Features:

- Neon Glow Effects
- Dynamic HUD Panels
- Real-Time Telemetry
- Responsive Layout
- Dark Futuristic Theme

---

# 📂 Project Structure

```bash
src/
│
├── components/
│   ├── lord/
│   │   ├── AppShell.tsx
│   │   ├── HealthHud.tsx
│   │   ├── ChatSidebar.tsx
│   │   ├── HudPanel.tsx
│   │
│   └── voice/
│
├── routes/
│   ├── chat.tsx
│   ├── voice.tsx
│   ├── dashboard.tsx
│
├── lib/
│   ├── lord-store.ts
│   ├── monitoring-service.ts
│   ├── use-persisted-state.ts
│   └── lord-config.ts
│
└── api/
```

---

# 🔥 Current Milestones

### Completed

- ✅ Multi-Mode AI Chat
- ✅ Conversation Persistence
- ✅ Chat History Sidebar
- ✅ Conversation Recovery
- ✅ Collapsible Health Panel
- ✅ Local Storage Architecture
- ✅ LORD UI System

### In Progress

- 🚧 Voice Pipeline
- 🚧 Speech Recognition
- 🚧 Wake Word Detection
- 🚧 Text-To-Speech
- 🚧 Memory Engine

### Future

- 🔮 Agent Workflows
- 🔮 Research Assistant
- 🔮 Autonomous Tasks
- 🔮 Personal Knowledge Base
- 🔮 Mobile Companion
- 🔮 Native Desktop Client

---

# ⚙️ Installation

```bash
git clone https://github.com/nagasatwik145/Lord.git

cd Lord

npm install

npm run dev
```

---

# 🔐 Environment Setup

Copy the example environment file and fill in your values. **Never commit `.env`** — it is git-ignored.

```bash
cp .env.example .env
```

| Variable                                  | Required | Where  | Purpose                                |
| ----------------------------------------- | -------- | ------ | -------------------------------------- |
| `VITE_SUPABASE_URL`                       | ✅       | Client | Supabase project URL (public)          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`           | ✅       | Client | Supabase anon/publishable key (public) |
| `SUPABASE_URL`                            | ✅       | Server | Supabase project URL (server)          |
| `SUPABASE_PUBLISHABLE_KEY`                | ✅       | Server | Supabase anon/publishable key (server) |
| `OPENROUTER_API_KEY`                      | ✅       | Server | OpenRouter API key for AI (secret)     |
| `TAVILY_API_KEY`                          | ⬜       | Server | Optional cited web search (secret; Sources toggle) |
| `SUPABASE_SERVICE_ROLE_KEY`               | ⬜       | Server | Admin client (bypasses RLS)            |
| `SUPABASE_PROJECT_ID`                     | ⬜       | Both   | Supabase CLI / tooling                 |
| `OPENROUTER_REFERER` / `OPENROUTER_TITLE` | ⬜       | Server | OpenRouter attribution headers         |

> Only `VITE_`-prefixed variables reach the browser. Keep `OPENROUTER_API_KEY` and
> service-role keys server-side only.

The chat **Sources** toggle requires `TAVILY_API_KEY`. Tavily currently lists a free plan
with 1,000 monthly API credits and no credit card; web search stops when its quota is
exhausted. Chat models continue to use LORD's free-only model routing.

---

# 🚀 Deploy to Vercel

LORD AI is a [TanStack Start](https://tanstack.com/start) app. The build uses the Nitro
`vercel` preset, which emits a Vercel **Build Output API** (`.vercel/output`) with a
Node.js serverless function (SSR + `/api/chat`) and static assets.

1. Push this repository to GitHub and import it in Vercel.
2. Vercel auto-detects the build (`npm run build`). No framework override is needed
   (`vercel.json` disables framework auto-detection so the Nitro output is used).
3. Add the environment variables above in **Project → Settings → Environment Variables**.
   At minimum set the four Supabase vars and `OPENROUTER_API_KEY`.
4. Deploy. The Node function runs on the same runtime the build targets
   (see `.nvmrc`).

Local production preview:

```bash
npm run build
npm run preview
```

---

# 🛡 Philosophy

LORD is built around a simple idea:

> AI should feel less like a chatbot and more like an intelligent Next-Gen AI for personal use only.

Instead of answering isolated questions, LORD aims to become a persistent, context-aware digital companion capable of assisting across projects, learning, productivity, and research.

---

# 👨‍💻 Developer

### Naga Satwik

Building a futuristic AI from the ground up.

> "The goal isn't to create another chatbot.
> The goal is to build Next-Gen J.A.R.V.I.S."

---

<div align="center">

### ⚡ LORD AI

**Command. Reason. Execute.**

Made with ❤️ and caffeine.

</div>
