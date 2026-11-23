# Google Gemini API Integration Specification

JARVIS integrates Google Gemini models as its conversational reasoning engine and external tool orchestrator. This document details the architectural implementation, protocol handling, security boundaries, and tool-dispatch mechanisms.

---

## 1. Architecture & Protocol Design

The Gemini integration is implemented natively in `server/aiProviderAdapter.js` using Node.js standard `https` libraries, intentionally avoiding external SDK dependencies.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Voice / UI)
    participant UI as Frontend (ES Modules)
    participant Server as Node.js HTTP Server (server.js)
    participant Adapter as AI Provider Adapter (aiProviderAdapter.js)
    participant Gemini as Google Gemini REST API
    participant Tools as Desktop Tool Registry (toolsRegistry.js)

    User->>UI: Speaks / Types Instruction
    UI->>Server: POST /api/chat/stream { message, personality }
    Server->>Adapter: dispatchQuery({ prompt, tools, history })
    Adapter->>Gemini: HTTPS POST /v1beta/models/{model}:streamGenerateContent
    Gemini-->>Adapter: Chunks (SSE JSON stream)
    Adapter-->>Server: Normalized Token Stream
    Server-->>UI: text/event-stream (SSE)
    
    opt Tool Call Required
        Gemini-->>Adapter: functionCall { name, args }
        Adapter->>Tools: validateAndExecuteTool(name, args)
        Tools-->>Adapter: Tool Execution Result
        Adapter->>Gemini: HTTPS POST (Function Response)
        Gemini-->>Adapter: Final Formatted Explanation
        Adapter-->>Server-->>UI: Streamed Final Answer
    end
    UI-->>User: Visual Eye Pulse & Spoken Audio
```

---

## 2. Model Selection & Configuration

The application dynamically selects Gemini models based on the active query complexity and configuration:

| Model ID | Target Workload | Context Window | Characteristics |
| :--- | :--- | :--- | :--- |
| `gemini-2.5-pro` | Complex multi-step reasoning, coding, engineering workflows | 1,000,000+ tokens | Deep reasoning, structured planning, complex tool workflows |
| `gemini-2.5-flash` | Real-time conversational dialogue, wake responses, rapid queries | 1,000,000+ tokens | Low latency, high throughput, lightweight tool calls |
| `gemini-2.0-flash` | Auxiliary fallback model | Standard | Fast conversational fallback |

Configuration is loaded from environment variables:
- `GEMINI_API_KEY`: Secret API key read from process environment (`process.env.GEMINI_API_KEY`).
- `AI_PROVIDER`: Set to `gemini` to enable cloud routing, or `local` for 100% offline fallback.

---

## 3. Tool Calling & Function Declarations

Gemini responses can trigger allowlisted desktop and system tools. Tool declarations are passed as OpenAPI-compliant schemas in the request payload:

1. **System Telemetry**: `get_windows_diagnostics`, `get_process_list`, `get_disk_usage`.
2. **Application Control**: `launch_application`, `focus_application`, `close_application`.
3. **Desktop Workflows**: `automate_whatsapp_message`, `automate_word_document`, `execute_browser_search`.
4. **File Operations**: `read_file`, `list_directory`, `inspect_code_security`.

When Gemini returns a `functionCall`, the server validates arguments against the centralized `PermissionGate` (enforcing authorization levels 0 through 4) before executing the action.

---

## 4. Error Handling & Incomplete Responses

The adapter incorporates defensive safeguards for network and API reliability:

1. **Structured Error Ledger**: API failures, rate limits (HTTP 429), and network timeouts are logged to `server/errorDiagnosticsService.js` with structured recovery suggestions.
2. **Offline Reminders**: If `GEMINI_API_KEY` is unset or invalid, the system does not crash; it smoothly falls back to local tools (Windows hardware diagnostics, clock, timers, static security analyzer) and politely informs the user through speech synthesis.
3. **Malformatted Output Recovery**: JSON extraction and response parsing handle truncated tokens, partial code blocks, and markdown code fencing gracefully.

---

## 5. Security & Key Management

- **Zero Hardcoded Secrets**: All API keys are loaded via `dotenv` from `.env`.
- **Git Protection**: `.env`, session tokens, and local credentials are listed in `.gitignore`.
- **Secret Redaction**: Error logs, audit trails, and debug telemetry automatically scrub API key patterns (`AIzaSy...`, `sk-...`, `Bearer...`) via regex filters before writing to disk.
- **Frontend Isolation**: API keys are never transmitted to or accessible from the client-side JavaScript environment.
