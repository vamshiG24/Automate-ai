# AutoMate AI

AutoMate AI is an agentic AI assistant that can **read and send Gmail, manage Google Calendar, analyze images, and publish Instagram posts**, with a human approval step before any action that changes something in the real world.

Users create their own **custom agents** (name, instructions, model, temperature, allowed tools), chat with them, and keep a searchable **chat history**. Usage is metered with a **credit system** and topped up through **Razorpay** payments.

---

## Features

| Area | What it does |
| --- | --- |
| **Agent Teams (new)** | One instruction → a Planner builds a team of specialist agents, each with **only the permissions its step needs**. Earlier agents' results are passed on as untrusted data |
| **Risk-based approval (new)** | Every real action gets a 0-100 risk score with plain-English reasons. Learns from your past approve/reject decisions. Low-risk actions can be auto-approved; prompt-injection attempts are always flagged high |
| Custom agents | Create agents with their own instructions, Groq model, temperature and an allow-list of tools |
| Tool calling via MCP | A Model Context Protocol server exposes Gmail, Calendar, Instagram and Gemini Vision tools to the LangGraph agent |
| Human-in-the-loop | Sending email, creating events and publishing posts pause the graph (`interrupt`) until the user approves or rejects |
| Chat history sidebar | Conversations grouped by date, with search, rename, pin and delete. Pending approvals survive a page refresh |
| Memory | LangGraph MongoDB checkpointer keeps each conversation's state per user and per agent |
| Integrations | Google OAuth (Gmail and Calendar) and Facebook Login for Business (Instagram). Each user connects their own accounts |
| Credits and payments | Credits are checked before every AI call. Razorpay orders are verified with HMAC signatures and credits are added atomically |
| Image understanding | Upload an image (Cloudinary) and ask about it (Google Gemini Vision), or turn it into an Instagram post |

## Architecture

```
 React (Vite + Tailwind + Redux)
        │  HTTPS + HttpOnly JWT cookie
        ▼
 Express API ──► MongoDB (users, agents, conversations, payments, integrations, checkpoints)
        │
        ├─► LangGraph agent (Groq LLM)
        │       │  approval interrupts ◄──► user
        │       ▼
        │   MCP client ──stdio──► MCP server (tools)
        │                           ├─ Gmail API
        │                           ├─ Google Calendar API
        │                           ├─ Instagram Graph API
        │                           └─ Gemini Vision
        │
        ├─► Firebase Admin (verifies Google sign-in)
        └─► Razorpay (orders + payment verification)
```

## Our contribution

### 1. Instruction-to-Team (least-privilege multi-agent planning)
Most agent apps give one agent every tool. AutoMate's **Planner** (`services/teamPlanner.service.js`) turns one instruction into a small dependency graph of specialist agents and grants each one only the capabilities its step needs. For example, an *Inbox Reader* can read Gmail but not send, and a *Sender* can send but not read. The **Team Runner** (`services/teamRunner.service.js`) executes the steps in order. Each agent's output reaches the next agent wrapped in `<<UNTRUSTED_DATA>>` markers, so instructions hidden inside an email can't silently steer a later agent.

```
"Check HOD's mail, add the deadline to my calendar, email a summary to Rahul"
                 │ Planner
   ┌─────────────┼──────────────────┐
 Inbox Reader   Calendar Scheduler   Summary Sender
 [gmail.read]   [event.schedule]     [gmail.send]
```

### 2. Risk-based, learning human-in-the-loop approval
Before any email, calendar event or Instagram post runs, a `riskAssess` node in the LangGraph agent (`services/risk.service.js`) scores it:

| Signal | Effect |
| --- | --- |
| Recipient typed by the user | lowers risk |
| Recipient only found in content the agent read (email, web page, another agent) | **+45, floored to HIGH**: possible prompt injection |
| Recipient guessed by the agent | +20 |
| Sensitive data (password, OTP, bank, payment…) | +30, **floored to MEDIUM**, never auto-approved |
| First email to this recipient / previously rejected | +20 / +25 |
| You approved this recipient ≥ 2 times before | −25 (learned trust) |
| Event in the past, at odd hours, very long | +30 / +10 / +10 |
| Public Instagram post | +45, never auto-approved |

The assessment is saved in the graph checkpoint *before* the approval node runs. When the user approves, LangGraph re-runs the approval node with the **same** assessment, so an auto-approve decision can't change between pausing and resuming. Every decision is stored (`ApprovalDecision`) and feeds back into future scores.

### Evaluation
```bash
cd backend
npm test           # 11 unit tests for the risk engine
npm run evaluate   # 20 benign + attack scenarios, 3 approval policies compared
```

| Policy | Risky actions stopped | Safe actions with no click | Clicks needed (20 actions) | Explains why |
| --- | --- | --- | --- | --- |
| Approve everything | 100% | 0% | 20 | no |
| No approval (fully autonomous) | 0% | 100% | 0 | no |
| **Risk-based (AutoMate)** | **100%** | **80%** | **12** | **yes** |

All 4 prompt-injection scenarios scored **high**. The evaluation also caught a flaw in an earlier version: bank details sent to a familiar contact were auto-approved. That led to the "sensitive data is never auto-approved" rule.

Live safety numbers per user are on the Agent Teams page and at `GET /api/approvals/stats`.

**Related work:** CrewAI and AutoGen are developer frameworks where the developer designs the team in code. Google DeepMind's *CaMeL* (2025) uses capabilities to defend against prompt injection. AutoMate combines **automatic team generation from a user's sentence**, **per-agent least privilege**, and **explainable, learning approvals** in a working product that takes real actions.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, Base UI / shadcn components, Redux Toolkit, Firebase Auth
- **Backend:** Node.js, Express 5, Mongoose, LangGraph.js, LangChain, Model Context Protocol SDK
- **AI:** Groq (`openai/gpt-oss-120b`), Google Gemini (vision)
- **Services:** MongoDB Atlas, Google OAuth, Meta Graph API, Razorpay, Cloudinary

## Security

- HttpOnly JWT session cookie (`Secure` + `SameSite=None` in production); Firebase ID tokens are verified on the server
- OAuth refresh and access tokens are encrypted at rest with **AES-256-GCM** and never returned by the API
- The OAuth `state` is a signed, short-lived JWT using its own secret (CSRF protection)
- The MCP server only accepts a 2-minute JWT (fixed issuer and audience) that the backend issues for the logged-in user
- Every query is scoped by `userId`, so users can only see their own agents, chats and integrations
- `helmet` security headers, rate limiting (stricter on AI and login routes), 100 kB JSON body limit
- The image-URL tool blocks private and internal IPs (SSRF protection) and does not follow redirects
- Razorpay signatures are checked with `timingSafeEqual`, and credits are granted with an atomic status update (no double crediting)
- The server refuses to start if a required secret is missing or `JWT_SECRET` is shorter than 32 characters

## Getting started

### Prerequisites
Node.js 20+, a MongoDB Atlas cluster, and API keys for Groq, Google (OAuth client + Gemini), Firebase, Razorpay (test mode) and Cloudinary. Instagram needs a Meta app.

### Backend
```bash
cd backend
npm install
cp .env.example .env              # then fill in the values
# add your Firebase Admin key as backend/serviceAccountKey.json
npm run dev                       # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env              # then fill in the values
npm run dev                       # http://localhost:5173
```

Generate random secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API overview

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Exchange a Firebase ID token for a session cookie |
| GET | `/api/auth/me` | Current user and credits |
| CRUD | `/api/agents` | Manage custom agents |
| POST | `/api/chat` | General chat (no tools) |
| POST | `/api/agent-chat` | Chat with an agent (may return an approval request) |
| POST | `/api/agent-chat/approve-email` | Approve or reject a pending action |
| GET | `/api/conversations` | Chat history (`?search=`) |
| GET / PATCH / DELETE | `/api/conversations/:threadId` | Open, rename/pin, or delete a chat |
| POST | `/api/team/plan` | Planner builds a team for an instruction |
| GET / PATCH / DELETE | `/api/team/runs/:id` | View, edit (before running) or delete a team run |
| POST | `/api/team/runs/:id/execute`, `/approve` | Run the team, approve/reject a paused action |
| GET | `/api/approvals/stats` | Safety statistics (auto-approved, rejected, injection flags) |
| PATCH | `/api/auth/settings` | Toggle auto-approve for low-risk actions |
| GET | `/api/integrations` | Connected accounts |
| POST | `/api/payment/create`, `/api/payment/verify` | Buy credits |

## Project structure

```
backend/
  config/        DB, Google OAuth, Razorpay, LangGraph checkpointer
  controllers/   Route handlers
  mcp/           MCP server (tools) + LangGraph MCP adapter
  middleware/    JWT auth
  models/        Mongoose schemas
  services/      LangGraph graphs, Planner, Team Runner, risk engine
  scripts/       evaluate-risk.js (offline evaluation)
  tests/         Unit tests (node --test)
  utils/         Encryption, credits, OAuth state, conversation history
frontend/
  src/pages/       Home (chat), Team, Agents, CreateAgent, Integrations, Pricing, Login
  src/components/  ChatSidebar, ApprovalCard (with risk panel) + UI kit
  src/features/    API helpers
```

## Submitting or sharing the code

**Never include `backend/.env`, `frontend/.env` or `backend/serviceAccountKey.json`.** Leave out `node_modules` and `dist` too. If any key has been shared by mistake, rotate it in the provider's dashboard.
