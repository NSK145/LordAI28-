# Create Apka Jalwa

## Phase 1 architecture

The authenticated `/create-apka-jalwa` route calls `/api/games`. The API uses the existing OpenRouter AI SDK integration to turn a prompt or follow-up request into a small JSON specification. Zod checks the request and `validateGameSpec` checks the returned data. The game itself runs in a reviewed, self-contained Canvas runner/dodge runtime; model output is never treated as HTML or JavaScript.

The preview uses `iframe srcDoc` with `sandbox="allow-scripts"` and no same-origin, storage, network, or device permissions. Its game content is created from validated, escaped data. The web ZIP contains this exact runtime as `index.html`, plus `game.json` and a README. No external assets or network services are needed by the exported game.

Projects are stored in `public.ai_games`. Apply `supabase/migrations/20261019000000_ai_games.sql` before using save/load. The API applies the authenticated user ID to every lookup, update, and delete; RLS provides a second ownership boundary. Version snapshots are stored with the project when saved.

## Configuration and local use

- Required for generation: server-side `OPENROUTER_API_KEY`.
- Optional: `OPENROUTER_BASE_URL` and `LORD_GAME_MODEL` (defaults to the repository's OpenRouter default model).
- Supabase URL and publishable/anon key must already be configured as required by LORD AI.
- Apply Supabase migrations, then run `npm run dev`, sign in, and visit `/create-apka-jalwa`.
- Enter a prompt of at least eight characters, create, play with Space/Up/W or touch, save, reopen from My Games, and download the ZIP. Extract it and open `index.html` in a modern browser to play offline.

## Scope boundaries

The current engine reliably implements an endless jump runner with obstacles, collision, score, difficulty scaling, restart, keyboard, and touch input. The AI is instructed to describe only those supported mechanics. Other game genres, hosted public links, and publish/unpublish are not implemented. No Android game-shell build runner or signing service is configured; APK export is explicitly marked as coming soon and no APK is generated. To add it, deploy a controlled external Android build worker and private artifact storage before exposing a build request or download operation.
