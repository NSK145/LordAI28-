# LORD WorldForge (Create Apka Jalwa)

WorldForge keeps the existing `/create-apka-jalwa` route and 2D Canvas engine while adding a data-driven Three.js 3D workflow. The model returns a structured specification; it never supplies HTML, JavaScript, remote assets, or executable scripts. The reviewed runtime selects a genre template and constructs the scene from validated, bounded values.

## Supported game formats

- **2D Canvas:** runner, rally, platformer, shooter, and puzzle.
- **3D Three.js:** runner, rally, racing, shooter, adventure, exploration, platformer, and fighting. 3D uses original low-poly/procedural scene assets and genre-specific controller templates. It is a kinematic game runtime, not a general-purpose physics simulator.
- **3D specification:** controller, camera, environment, lighting, material style, physics parameters, collision radius, abilities/mechanics, enemies, obstacles, collectibles, levels, scoring, health, sound-effect settings, UI/touch settings, controls, and win/lose conditions. Zod applies safe defaults to older v3 saves and rejects out-of-range or unsupported values.
- **Input and rendering:** keyboard and touch controls, responsive HUD, pause/restart, low/medium/high quality, pixel-ratio caps, lower mobile scene density, and high-quality real-time shadows when enabled. Space starfields use a point cloud to avoid one draw call per star.
- **Not supported:** arbitrary imported 3D models, networked multiplayer, user-supplied scripts, general physics-engine features, music tracks, hosted publishing, and game-specific Android APK builds.

The current runtime has no external game assets to fetch. 3D sound is optional synthesized action-effect audio; it does not use bundled music or remote audio files. Camera and physics settings use the supported genre controllers and are not arbitrary simulation graphs.

## Generation, editing, and validation

The authenticated page calls `/api/games`. Server-side generation uses `OPENROUTER_API_KEY`; the provider result is schema-validated, genre-checked, and stored in the user's `public.ai_games` row. The runtime validates the saved 3D specification again before mounting. Runtime exceptions are logged and surfaced with a restart path.

An edit includes the current full specification, but only recognized sections requested by the edit are copied from the model response. Other changed fields are discarded; requests that do not identify a supported section are rejected rather than appearing to succeed. Version history continues to store validated specifications.

The displayed test report distinguishes schema validation from actual play: generation does not run an automated gameplay test. The preview reports its current runtime state; export metadata reports that automated gameplay and browser-runtime tests were not run.

The 3D preview and game specification contain no generated code. 2D previews use an `iframe` sandbox with scripts only and no same-origin, storage, or device permissions. Generated specifications are data-only, and the bundled Three.js runtime does not receive authentication tokens or call privileged APIs.

## Pro access and persistence

3D generation, modification, save/version payloads, and saved-game reads are checked server-side against LORD Pro. The generation result is checked too, so a 2D-to-3D edit cannot bypass entitlement by submitting a 2D starting spec. Pro status uses the existing monthly/yearly plans (₹99/month and ₹990/year by default) and existing configured lifetime-free identities. The UI displays the prices returned by the billing status endpoint.

Apply the migrations in `supabase/migrations` before using persistence. The games API scopes reads, edits, and deletes to the authenticated user ID; database RLS is an additional ownership boundary.

## Export and Android status

**Download web ZIP** is available for supported 2D and 3D games. A 3D ZIP includes `index.html`, `three-runtime.js`, `game.json`, and a README; it runs from a static web server and does not require a LORD AI session, API key, CDN, or external assets. ZIP metadata explicitly records that automated gameplay testing was not run.

No game-specific Android build/signing service is configured. WorldForge does not generate an APK and does not label a web ZIP as an APK. The existing application APK workflow builds the LORD AI app, not a user's generated game.

## Local development

- Configure the existing Supabase URL and publishable/anon key.
- Configure `OPENROUTER_API_KEY`; optionally set `OPENROUTER_BASE_URL` and `LORD_GAME_MODEL`.
- Apply database migrations, then run `npm run dev`, sign in, and open `/create-apka-jalwa`.
- Run focused checks with `npm test -- --run src/lib/games/game-3d.test.ts src/lib/games/game-generation.test.ts src/lib/games/game-service.test.ts`. Run `npm run build` for the production frontend build.
