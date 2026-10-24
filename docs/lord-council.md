# LORD Council

LORD Council is an opt-in chat workflow served by the authenticated `/api/chat` endpoint and the existing OpenRouter adapter/model registry. It does not send provider credentials to the browser.

Council classifies the latest task, checks the configured OpenRouter account and registered model IDs, then selects up to three eligible models by task capability, latency, and catalog pricing. Free accounts are restricted server-side to `cohere/north-mini-code:free` (North Mini Code) and `google/gemma-3-27b-it` (Gemma 3 27B IT); Pro access uses the existing entitlement check, including lifetime entitlements. Simple general questions use one model. When fewer than two eligible models are usable, results identify themselves as reduced/single-model mode or fall back to standard chat.

For a multi-model run, independent contributions are collected in parallel, a reviewer checks for errors, unsupported claims, contradictions, and omissions, and a synthesizer produces the final answer. The interface shows role/model assignments, status, short contribution summaries, and disagreements. Full private reasoning is not requested or displayed. Streaming cancellation aborts outstanding provider requests; failed contributors are marked and the remaining successful results may still be synthesized. Retry replays the last chat turn.

## Server limits

Optional server-only environment variables configure Council limits. Invalid values use defaults and values are clamped to safe ranges.

| Variable                           | Default |        Range |
| ---------------------------------- | ------: | -----------: |
| `LORD_COUNCIL_MAX_PARALLEL`        |       3 |          1–3 |
| `LORD_COUNCIL_MAX_RETRIES`         |       0 |          0–1 |
| `LORD_COUNCIL_MAX_OUTPUT_TOKENS`   |     400 |      128–800 |
| `LORD_COUNCIL_TIMEOUT_MS`          |   25000 |   5000–60000 |
| `LORD_COUNCIL_MAX_COST_USD`        |    0.05 | $0.001–$1.00 |
| `LORD_COUNCIL_REQUESTS_PER_MINUTE` |       4 |         1–20 |

The per-user request limiter is enforced in server code and is process-local, matching the current web-search limiter. Deployments that need a globally shared quota across multiple server instances should move the counter to a shared atomic store. Estimated request cost is checked against registered model pricing before provider calls; this is an estimate, not a provider invoice.

Provider model-list availability is cached server-side for up to 30 seconds; failed health checks are cached for five seconds. Only availability results and a one-way credential fingerprint are cached—prompts, responses, and raw credentials are not.

No additional API credentials are required. Council needs the same server-side `OPENROUTER_API_KEY` and Supabase authentication/entitlement configuration as standard chat. If model availability checks or all Council providers fail, the application uses the existing standard-chat fallback where possible and does not claim that multiple models collaborated.
