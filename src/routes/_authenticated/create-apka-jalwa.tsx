import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Gamepad2,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lord/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGameHtml, type GameSpec } from "@/lib/games/game-runtime";
import { createGameZip } from "@/lib/games/game-export";
import { requestGamesApi, SingleFlightGate } from "@/lib/games/game-api-client";

type SavedGame = {
  id: string;
  spec: GameSpec;
  prompt: string;
  versions: GameSpec[];
  updated_at: string;
};
const examples = [
  "A neon endless runner through Mumbai at night",
  "A space pilot dodging asteroids and collecting stars",
  "A desert rally dodging rocks and collecting fuel",
  "A jungle explorer who jumps over fallen trees",
];
export const Route = createFileRoute("/_authenticated/create-apka-jalwa")({
  head: () => ({
    meta: [
      { title: "Create Apka Jalwa — LORD AI" },
      { name: "description", content: "Create, play, and export a game with AI." },
    ],
  }),
  component: GameStudio,
});

function GameStudio() {
  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GameSpec["difficulty"]>("normal");
  const [game, setGame] = useState<SavedGame | null>(null);
  const [games, setGames] = useState<SavedGame[]>([]);
  const [busy, setBusy] = useState("");
  const [studioError, setStudioError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [instruction, setInstruction] = useState("");
  const generationGate = useRef(new SingleFlightGate());
  const preview = useMemo(() => (game ? createGameHtml(game.spec) : ""), [game]);
  useEffect(() => {
    requestGamesApi<{ games: SavedGame[] }>({ action: "list" })
      .then(({ games: savedGames }) => {
        setGames(savedGames);
        setStudioError("");
      })
      .catch((error: unknown) => {
        setStudioError(error instanceof Error ? error.message : "Could not load your saved games.");
      });
  }, []);
  const generate = async () => {
    if (prompt.trim().length < 8) return;
    const operation = generationGate.current.run(async () => {
      return requestGamesApi<{ game: SavedGame }>({
        action: "generate",
        prompt: prompt.trim(),
        difficulty,
      });
    });
    if (!operation) return;
    setBusy("Generating your playable game…");
    try {
      const { game: created } = await operation;
      setGame(created);
      setGames((prev) => [created, ...prev.filter((saved) => saved.id !== created.id)]);
      setStudioError("");
      toast.success("Your game was created, saved, and is ready to play");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    if (!game) return;
    setBusy("Saving game…");
    try {
      const { game: saved } = await requestGamesApi<{ game: SavedGame }>({
        action: "save",
        id: game.id || undefined,
        spec: game.spec,
        prompt: game.prompt,
        versions: game.versions,
      });
      setGame(saved);
      setGames((prev) => [saved, ...prev.filter((g) => g.id !== saved.id)]);
      toast.success("Game saved to My Games");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy("");
    }
  };
  const modify = async () => {
    if (!game || !instruction.trim()) return;
    setBusy("Updating your game…");
    try {
      const { spec } = await requestGamesApi<{ spec: GameSpec }>({
        action: "modify",
        spec: game.spec,
        instruction,
      });
      setGame({ ...game, spec, versions: [...game.versions, game.spec] });
      setInstruction("");
      setRefreshKey((k) => k + 1);
      toast.success("Game updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy("");
    }
  };
  const openGame = async (id: string) => {
    setBusy("Opening game…");
    try {
      const { game: loaded } = await requestGamesApi<{ game: SavedGame }>({ action: "get", id });
      setGame(loaded);
      setPrompt(loaded.prompt);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open game");
    } finally {
      setBusy("");
    }
  };
  const exportZip = async () => {
    if (!game) return;
    const blob = await createGameZip(game.spec, game.prompt);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(game.spec.title)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const remove = async (id: string) => {
    try {
      await requestGamesApi({ action: "delete", id });
      setGames((prev) => prev.filter((g) => g.id !== id));
      if (game?.id === id) setGame(null);
      toast.success("Game deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  return (
    <AppShell>
      <main className="jalwa min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.24em] text-cyan-300">
                <Gamepad2 size={16} /> LORD AI GAME STUDIO
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                Create Apka Jalwa
              </h1>
              <p className="mt-3 text-base text-slate-300">
                Your imagination. Your game. Powered by AI.
              </p>
            </div>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-200">
              2D · Instant playable preview
            </span>
          </div>
          {studioError && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm text-amber-100"
            >
              {studioError}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)]">
            <Card className="border-white/10 bg-[#0b1424]/90 p-5 shadow-[0_20px_80px_#02081780] sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300">
                  <Sparkles size={21} />
                </div>
                <div>
                  <h2 className="font-bold text-white">What do you want to make?</h2>
                  <p className="text-sm text-slate-400">
                    Describe a game. Jalwa turns it into a playable runner.
                  </p>
                </div>
              </div>
              <Label htmlFor="game-prompt" className="sr-only">
                Describe your game
              </Label>
              <textarea
                id="game-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={1200}
                placeholder="A neon runner through a futuristic Indian city, jumping over traffic and collecting glowing coins…"
                className="min-h-36 w-full resize-y rounded-xl border border-white/10 bg-[#060d19] p-4 text-sm leading-6 text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <Label htmlFor="difficulty" className="mb-2 block text-xs text-slate-400">
                    Difficulty
                  </Label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as GameSpec["difficulty"])}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#101c2d] px-3 text-sm text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <Button
                  onClick={generate}
                  disabled={!!busy || prompt.trim().length < 8}
                  className="h-11 bg-cyan-300 px-6 font-bold text-slate-950 hover:bg-cyan-200"
                >
                  {busy.includes("Generating") ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  {busy.includes("Generating") ? "Creating…" : "Create Game"}
                </Button>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Need an idea?
                </p>
                <div className="flex flex-wrap gap-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              {busy && (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm text-cyan-200">
                  <LoaderCircle size={15} className="animate-spin" />
                  {busy}
                </p>
              )}
            </Card>
            <Card className="overflow-hidden border-white/10 bg-[#0b1424]/90 p-0 shadow-[0_20px_80px_#02081780]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-bold text-white">
                    {game?.spec.title ?? "Your game preview"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {game
                      ? `${game.spec.genre} · ${game.spec.difficulty} · ${game.spec.theme}`
                      : "Create a game to start playing"}
                  </p>
                </div>
                {game && (
                  <Button
                    aria-label="Restart game"
                    variant="outline"
                    size="sm"
                    onClick={() => setRefreshKey((k) => k + 1)}
                  >
                    <RotateCcw size={15} /> Restart
                  </Button>
                )}
              </div>
              {game ? (
                <iframe
                  key={refreshKey}
                  title={`${game.spec.title} playable game`}
                  srcDoc={preview}
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full border-0 bg-[#07111f] sm:aspect-[16/10]"
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-[radial-gradient(ellipse_at_center,#10283a,#07111f_70%)] sm:aspect-[16/10]">
                  <div className="text-center">
                    <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-300">
                      <Play />
                    </div>
                    <p className="text-sm text-slate-300">A real game appears here</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Touch or keyboard controls included
                    </p>
                  </div>
                </div>
              )}
              {game && (
                <div className="flex flex-wrap gap-2 p-4">
                  <Button
                    onClick={save}
                    disabled={!!busy}
                    className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  >
                    <Save />
                    Save game
                  </Button>
                  <Button variant="outline" onClick={exportZip}>
                    <Download />
                    Download web ZIP
                  </Button>
                  <Button variant="outline" disabled title="Publishing is part of Phase 2">
                    <Plus />
                    Publish · coming soon
                  </Button>
                </div>
              )}
            </Card>
          </div>
          {game && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
              <Card className="border-white/10 bg-[#0b1424]/90 p-5">
                <h2 className="mb-1 font-bold text-white">Customize with AI</h2>
                <p className="mb-4 text-sm text-slate-400">
                  Changes update the validated game spec. Unsupported requests stay out of the game.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void modify();
                    }}
                    placeholder="Make it harder, change the theme…"
                    className="border-white/10 bg-[#060d19] text-white"
                  />
                  <Button onClick={modify} disabled={!!busy || !instruction.trim()}>
                    <Sparkles />
                    Update game
                  </Button>
                </div>
                {game.versions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="self-center text-xs text-slate-500">Version history:</span>
                    {game.versions.map((v, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setGame({
                            ...game,
                            spec: v,
                            versions: [
                              ...game.versions.slice(0, i),
                              ...game.versions.slice(i + 1),
                              game.spec,
                            ],
                          });
                          setRefreshKey((k) => k + 1);
                        }}
                      >
                        Restore v{i + 1}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="border-white/10 bg-[#0b1424]/90 p-5">
                <h3 className="mb-3 font-bold text-white">Game guide</h3>
                <p className="text-sm leading-6 text-slate-300">{game.spec.objective}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {game.spec.controls.join(" · ") || "Space · ↑ · W · Touch to jump"}
                </p>
              </Card>
            </div>
          )}
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
            <section>
              <h2 className="mb-1 text-xl font-bold text-white">My Games</h2>
              <p className="mb-4 text-sm text-slate-400">
                Saved privately to your LORD AI account.
              </p>
              {games.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {games.map((g) => (
                    <Card
                      key={g.id}
                      className="flex items-center justify-between border-white/10 bg-[#0b1424] p-4"
                    >
                      <button onClick={() => void openGame(g.id)} className="min-w-0 text-left">
                        <b className="block truncate text-sm text-white">{g.spec.title}</b>
                        <span className="text-xs text-slate-400">
                          {g.spec.genre} · Updated {new Date(g.updated_at).toLocaleDateString()}
                        </span>
                      </button>
                      <Button
                        aria-label={`Delete ${g.spec.title}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(g.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                  No saved games yet. Create something and save it here.
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-1 text-xl font-bold text-white">Discover</h2>
              <p className="mb-4 text-sm text-slate-400">Starter ideas you can make your own.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Neon City Runner", "Asteroid Drift", "Desert Dash", "Jungle Leap"].map(
                  (name, i) => (
                    <button
                      key={name}
                      onClick={() => setPrompt(examples[i])}
                      className="rounded-xl border border-white/10 bg-gradient-to-br from-[#101c30] to-[#09111f] p-4 text-left transition hover:border-cyan-300/40"
                    >
                      <span className="mb-3 block text-2xl">{["🌆", "🚀", "🏜️", "🌴"][i]}</span>
                      <b className="text-sm text-white">{name}</b>
                      <span className="mt-1 block text-xs text-slate-400">
                        Use this as a prompt idea
                      </span>
                    </button>
                  ),
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                APK export · coming soon. Android builds are not configured for this deployment.
              </p>
            </section>
          </div>
        </div>
      </main>
      <style>{`.jalwa{background:radial-gradient(ellipse at 82% 4%,#10314b55,transparent 33%),linear-gradient(180deg,#060b14,#080e19 50%,#060b14)}.jalwa button:focus-visible,.jalwa select:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}`}</style>
    </AppShell>
  );
}
function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "jalwa-game"
  );
}
