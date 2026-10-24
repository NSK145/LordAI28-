import type { MemoryRecord } from "./types";

export interface MindGraphProject {
  id: string;
  name: string;
}

export interface MindGraphTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  project_id: string;
}

export interface MindGraphConversation {
  id: string;
  title: string | null;
  created_at: string;
  project_id: string | null;
}

export interface MindGraphFile {
  id: string;
  name: string;
  source_type: string;
  created_at: string;
  project_id: string | null;
}

export interface MindGraphNode {
  id: string;
  label: string;
  description: string;
  kind: "project" | "task" | "memory" | "conversation" | "file" | "outcome";
  category: string;
  source: string;
  timestamp: string;
  confidence: number;
  projectId: string | null;
  memory?: MemoryRecord;
  status?: string;
}

export interface MindGraphEdge {
  from: string;
  to: string;
  relation: "belongs to" | "related" | "possible conflict" | "source conversation";
}

export function mindGraphNodeColor(node: MindGraphNode): string {
  if (node.kind === "project") return "#60a5fa";
  if (node.kind === "outcome") return "#2dd4bf";
  if (node.category === "bug") return "#f87171";
  if (node.kind === "task") return node.status === "done" ? "#64748b" : "#c084fc";
  if (node.kind === "conversation") return "#f472b6";
  if (node.kind === "file") return "#fb923c";
  if (node.memory?.confirmation_status === "suggested") return "#fbbf24";
  if (node.category === "preference") return "#22d3ee";
  if (/decid(ed|e)|decision/i.test(node.description)) return "#a78bfa";
  return "#34d399";
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "for",
  "from",
  "have",
  "into",
  "just",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "this",
  "with",
  "would",
  "your",
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function overlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / Math.min(a.size, b.size);
}

function hasNegation(value: string): boolean {
  return /\b(no|not|never|don't|doesn't|didn't|cannot|can't|won't|dislike|hate)\b/i.test(value);
}

export function arePossibleDuplicates(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return (
    hasNegation(left) === hasNegation(right) &&
    (normalize(left) === normalize(right) || overlap(left, right) >= 0.82)
  );
}

export function arePossibleConflicts(left: string, right: string): boolean {
  return hasNegation(left) !== hasNegation(right) && overlap(left, right) >= 0.62;
}

export function buildMindGraph(
  memories: MemoryRecord[],
  projects: MindGraphProject[],
  tasks: MindGraphTask[],
  conversations: MindGraphConversation[] = [],
  files: MindGraphFile[] = [],
): { nodes: MindGraphNode[]; edges: MindGraphEdge[] } {
  const nodes: MindGraphNode[] = [
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      description: project.name,
      kind: "project" as const,
      category: "project",
      source: "Project workspace",
      timestamp: "",
      confidence: 1,
      projectId: project.id,
    })),
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      description: `${task.title} · ${task.status} · ${task.priority} priority`,
      kind: "task" as const,
      category: /\b(bug|defect|issue)\b/i.test(task.title) ? "bug" : "task",
      source: "Project task",
      timestamp: task.created_at,
      confidence: 1,
      projectId: task.project_id,
      status: task.status,
    })),
    ...conversations.map((conversation) => ({
      id: `conversation:${conversation.id}`,
      label: conversation.title?.trim() || "Untitled conversation",
      description: conversation.title?.trim() || "Untitled conversation",
      kind: "conversation" as const,
      category: "conversation",
      source: "Conversation history",
      timestamp: conversation.created_at,
      confidence: 1,
      projectId: conversation.project_id,
    })),
    ...files.map((file) => ({
      id: `file:${file.id}`,
      label: file.name,
      description: `${file.name} · ${file.source_type}`,
      kind: "file" as const,
      category: file.source_type,
      source: "Project knowledge source",
      timestamp: file.created_at,
      confidence: 1,
      projectId: file.project_id,
    })),
    ...memories.map((memory) => ({
      id: `memory:${memory.id}`,
      label: memory.content,
      description: memory.content,
      kind:
        memory.confirmation_status === "confirmed" &&
        /^Project work completed:/i.test(memory.content)
          ? ("outcome" as const)
          : ("memory" as const),
      category:
        memory.confirmation_status === "confirmed" &&
        /^Project work completed:/i.test(memory.content)
          ? "outcome"
          : memory.category,
      source: memory.source,
      timestamp: memory.created_at,
      confidence: memory.confidence,
      projectId: memory.project_id ?? null,
      memory,
    })),
  ];

  const edges: MindGraphEdge[] = [];
  const relationCount = new Map<string, number>();
  const addRelatedEdge = (edge: MindGraphEdge, perNodeLimit: number) => {
    if (
      (relationCount.get(edge.from) ?? 0) >= perNodeLimit ||
      (relationCount.get(edge.to) ?? 0) >= perNodeLimit
    ) {
      return;
    }
    edges.push(edge);
    relationCount.set(edge.from, (relationCount.get(edge.from) ?? 0) + 1);
    relationCount.set(edge.to, (relationCount.get(edge.to) ?? 0) + 1);
  };

  for (const node of nodes) {
    if (node.kind !== "project" && node.projectId) {
      const projectNodeId = `project:${node.projectId}`;
      if (nodes.some((candidate) => candidate.id === projectNodeId)) {
        addRelatedEdge({ from: node.id, to: projectNodeId, relation: "belongs to" }, 1000);
      }
    }
  }

  for (const memoryNode of nodes.filter((node) => node.memory)) {
    const conversationId = memoryNode.memory?.source_conversation_id;
    if (conversationId && nodes.some((node) => node.id === `conversation:${conversationId}`)) {
      addRelatedEdge(
        {
          from: memoryNode.id,
          to: `conversation:${conversationId}`,
          relation: "source conversation",
        },
        1000,
      );
    }
  }

  const memoryNodes = nodes.filter((node) => node.memory);
  for (let left = 0; left < memoryNodes.length; left++) {
    for (let right = left + 1; right < memoryNodes.length; right++) {
      const first = memoryNodes[left];
      const second = memoryNodes[right];
      const confidence = overlap(first.description, second.description);
      if (arePossibleConflicts(first.description, second.description)) {
        addRelatedEdge({ from: first.id, to: second.id, relation: "possible conflict" }, 4);
      } else if (confidence >= 0.3) {
        addRelatedEdge({ from: first.id, to: second.id, relation: "related" }, 4);
      }
    }
  }

  for (const taskNode of nodes.filter((node) => node.kind === "task")) {
    for (const memoryNode of memoryNodes) {
      if (overlap(taskNode.description, memoryNode.description) >= 0.45) {
        addRelatedEdge({ from: taskNode.id, to: memoryNode.id, relation: "related" }, 2);
      }
    }
  }

  return { nodes, edges };
}

export function findMemoryIssues(
  memory: MemoryRecord,
  memories: MemoryRecord[],
): { duplicates: MemoryRecord[]; conflicts: MemoryRecord[] } {
  const others = memories.filter((item) => item.id !== memory.id);
  return {
    duplicates: others.filter(
      (item) =>
        item.category === memory.category && arePossibleDuplicates(memory.content, item.content),
    ),
    conflicts: others.filter(
      (item) =>
        item.category === memory.category && arePossibleConflicts(memory.content, item.content),
    ),
  };
}
