# LORD Mind Graph

Mind Graph is an account-private view of existing LORD project data: projects,
project tasks, recent conversations, knowledge sources, and saved memories. Use
the project selector, search, and filters to focus the graph; drag to pan, use
the mouse wheel to zoom, and select a node to inspect it. On small screens the
same nodes are provided as an accessible list.

Memory nodes retain their source conversation, creation time, confidence, and
review state. Model-detected items are suggestions, not confirmed facts, and
are excluded from answer context until confirmed. Edges indicate project
membership, memory/source provenance, or possible text relationships; they are
navigation aids, not proof that two statements are true or related.

The detail panel can edit, confirm, pin, archive, delete, and control whether a
confirmed memory may be used in answer context. Disabling memory stops new
memory collection and retrieval but does not delete existing records. Clearing
a project's memories only deletes memory records assigned to that project; it
does not delete conversations, project tasks, or copies stored elsewhere.

Graph requests are bounded (up to 120 memories per page, 60 tasks, 50
conversations, 50 knowledge sources, and 50 projects per view). Use the
Newer/Older controls to page through memory history. The database migration
`20261024010000_lord_mind_graph.sql` adds memory confirmation, source, and
context-use metadata, enforces owner-scoped references, and honors the
existing memory consent setting.
