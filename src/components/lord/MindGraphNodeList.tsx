import type { MindGraphNode } from "@/lib/memory/graph";
import { mindGraphNodeColor } from "@/lib/memory/graph";
import { cn } from "@/lib/utils";

export function MindGraphNodeList({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: MindGraphNode[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <ul
      className="grid max-h-[28rem] gap-2 overflow-y-auto p-3 md:hidden"
      aria-label="Mind Graph nodes"
    >
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            onClick={() => onSelect(node.id)}
            aria-pressed={selectedId === node.id}
            className={cn(
              "flex min-h-12 w-full items-center gap-3 rounded-lg border p-3 text-left text-sm",
              selectedId === node.id
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-background/30",
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: mindGraphNodeColor(node) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {node.memory?.confirmation_status === "suggested" ? "Review" : node.category}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
