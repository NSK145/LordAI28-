import { useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Brain,
  BookOpen,
  CalendarDays,
  FileText,
  FolderOpen,
  Image,
  MessageSquare,
  Mic,
  Network,
  Plus,
  Search,
  Settings,
  SquarePen,
  Target,
} from "lucide-react";
import {
  actionCommand,
  CommandPalette as CommandPaletteComponent,
  createCommandItem,
  useCommandPalette,
} from "./command-palette";

function useAppCommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const go = (to: string) => () => void navigate({ to } as never);
    const route = (label: string, to: string, icon: ReactNode, description: string) =>
      createCommandItem({
        label,
        description,
        icon,
        group: "navigation",
        keywords: [label.toLowerCase(), to.replaceAll("/", " ")],
        action: go(to),
      });

    return [
      route("Home", "/", <Activity className="h-4 w-4" />, "Open the command center"),
      route("Chat", "/chat", <MessageSquare className="h-4 w-4" />, "Open your conversations"),
      route("Study", "/study", <BookOpen className="h-4 w-4" />, "Open the study workspace"),
      route(
        "Research & documents",
        "/documents",
        <FileText className="h-4 w-4" />,
        "Browse research and documents",
      ),
      route("Projects", "/projects", <FolderOpen className="h-4 w-4" />, "Open project workspaces"),
      route("Calendar", "/calendar", <CalendarDays className="h-4 w-4" />, "View your calendar"),
      route("Tasks", "/productivity", <Target className="h-4 w-4" />, "Open tasks and focus tools"),
      route(
        "Search conversations",
        "/search",
        <Search className="h-4 w-4" />,
        "Search saved conversations",
      ),
      route("Memory", "/memory", <Brain className="h-4 w-4" />, "Review saved memories"),
      route(
        "Mind Graph",
        "/mind-graph",
        <Network className="h-4 w-4" />,
        "Explore project memories and connections",
      ),
      route("Images", "/images", <Image className="h-4 w-4" />, "Open image generation"),
      route("Voice", "/voice", <Mic className="h-4 w-4" />, "Open voice controls"),
      route("Settings", "/settings", <Settings className="h-4 w-4" />, "Manage your preferences"),
      route(
        "Command Center tools",
        "/command-center",
        <Activity className="h-4 w-4" />,
        "Open connected device and automation tools",
      ),
      actionCommand(
        "New chat",
        () => {
          void navigate({ to: "/chat" }).then(() => {
            window.setTimeout(() => window.dispatchEvent(new Event("lord:new-chat")), 50);
          });
        },
        {
          icon: <SquarePen className="h-4 w-4" />,
          description: "Start a new conversation",
          shortcut: ["N"],
          keywords: ["new conversation", "compose"],
        },
      ),
      actionCommand("Open projects", go("/projects"), {
        icon: <Plus className="h-4 w-4" />,
        description: "Browse or create a project",
        keywords: ["project", "workspace"],
      }),
    ];
  }, [navigate]);

  return { open, setOpen, items };
}

export function AppCommandPalette() {
  const { open, setOpen, items } = useAppCommandPalette();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/55 px-3 text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-52 sm:justify-start"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left text-xs sm:inline">Search or jump to…</span>
        <kbd className="hidden rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
          Ctrl / ⌘ K
        </kbd>
      </button>
      <CommandPaletteComponent open={open} onOpenChange={setOpen} items={items} />
    </>
  );
}
