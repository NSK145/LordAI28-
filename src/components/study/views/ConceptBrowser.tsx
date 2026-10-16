import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SortAsc, SortDesc, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConceptCard } from "../ui/ConceptCard";
import { StudyHeader } from "../StudyHeader";
import { AddSubjectDialog } from "./AddSubjectDialog";
import { AddConceptDialog } from "./AddConceptDialog";
import { filterConceptsForClass } from "@/lib/learning/class";
import type { LearningSnapshot, StudyView } from "../types";

interface ConceptBrowserProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  onConceptClick: (conceptId: string) => void;
  onNavigate: (view: StudyView) => void;
  refresh: () => void;
}

type SortKey = "title" | "mastery" | "subject";
type SortDir = "asc" | "desc";

export function ConceptBrowser({
  snapshot,
  userId,
  onConceptClick,
  onNavigate,
  refresh,
}: ConceptBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [frameworkFilter, setFrameworkFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const profile = useMemo(() => snapshot?.profile, [snapshot?.profile]);
  const classNumber = profile?.class ?? null;
  const allConcepts = useMemo(() => snapshot?.concepts ?? [], [snapshot?.concepts]);
  const mastery = useMemo(() => snapshot?.mastery ?? [], [snapshot?.mastery]);
  const tasks = useMemo(() => snapshot?.tasks ?? [], [snapshot?.tasks]);
  const masteryMap = useMemo(() => new Map(mastery.map((m) => [m.concept_id, m])), [mastery]);

  const concepts = useMemo(() => {
    return filterConceptsForClass(allConcepts, classNumber);
  }, [allConcepts, classNumber]);

  const customSubjects = useMemo(
    () => (profile?.custom_subjects ?? []).map((s) => s.name),
    [profile?.custom_subjects],
  );

  const subjects = useMemo(
    () => Array.from(new Set([...concepts.map((c) => c.subject), ...customSubjects])).sort(),
    [concepts, customSubjects],
  );
  const frameworks = useMemo(
    () => Array.from(new Set(concepts.map((concept) => concept.framework).filter(Boolean))).sort(),
    [concepts],
  );

  const filtered = useMemo(() => {
    let result = concepts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.standard_code.toLowerCase().includes(q) ||
          (c.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false),
      );
    }

    if (subjectFilter) {
      result = result.filter((c) => c.subject === subjectFilter);
    }

    if (frameworkFilter) {
      result = result.filter((c) => c.framework === frameworkFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortBy === "subject") {
        cmp = (a.subject ?? "").localeCompare(b.subject ?? "");
      } else if (sortBy === "mastery") {
        const sa = masteryMap.get(a.id)?.score ?? 0;
        const sb = masteryMap.get(b.id)?.score ?? 0;
        cmp = sa - sb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [concepts, searchQuery, subjectFilter, frameworkFilter, sortBy, sortDir, masteryMap]);

  const clearFilters = () => {
    setSearchQuery("");
    setSubjectFilter(null);
    setFrameworkFilter(null);
  };

  const masteredCount = mastery.filter((m) => m.score >= 0.8).length;
  const totalConcepts = concepts.length;
  const overallMasteryPercent =
    totalConcepts > 0 ? Math.round((masteredCount / totalConcepts) * 100) : 0;
  const addedConceptIds = tasks.filter((t) => t.concept_id).map((t) => t.concept_id as string);

  return (
    <div className="p-6">
      <StudyHeader
        view="concepts"
        title="Concept Library"
        subtitle={
          classNumber
            ? `Class ${classNumber} · ${concepts.length} concepts available`
            : `${concepts.length} concepts available`
        }
        icon={<BookOpen className="h-6 w-6 text-primary" />}
        onBack={() => onNavigate("dashboard")}
        showBack
        action={
          <div className="flex items-center gap-2">
            <AddSubjectDialog userId={userId} refresh={refresh} />
            <AddConceptDialog
              userId={userId}
              subjects={subjects}
              concepts={concepts}
              classNumber={classNumber}
              refresh={refresh}
              onAdded={onConceptClick}
            />
          </div>
        }
        masteryPercent={overallMasteryPercent}
        totalConcepts={totalConcepts}
        masteredCount={masteredCount}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative mb-6"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          aria-label="Search concepts, curriculum codes, and keywords"
          placeholder="Search concepts, codes, or keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border/40 bg-background/60 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:border-primary/50 focus:outline-none"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mb-4 flex flex-wrap items-center gap-3"
      >
        <div className="flex flex-wrap gap-2">
          {(searchQuery || subjectFilter || frameworkFilter) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/30"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => setSubjectFilter(subjectFilter === subject ? null : subject)}
              aria-pressed={subjectFilter === subject}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                subjectFilter === subject
                  ? "bg-primary/15 text-primary"
                  : "border border-border/40 text-muted-foreground hover:bg-muted/20",
              )}
            >
              {subject}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Filter by curriculum"
            value={frameworkFilter ?? ""}
            onChange={(event) => setFrameworkFilter(event.target.value || null)}
            className="max-w-36 rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="">All curricula</option>
            {frameworks.map((framework) => (
              <option key={framework} value={framework}>
                {framework}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort concepts by"
            value={String(sortBy)}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="title">Title</option>
            <option value="mastery">Mastery</option>
            <option value="subject">Subject</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="rounded-md border border-border/40 bg-background/60 p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Toggle sort direction"
          >
            {sortDir === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center text-muted-foreground"
          >
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p>No concepts match your search.</p>
          </motion.div>
        ) : (
          <motion.div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            initial="hide"
            animate="show"
            variants={{
              show: { transition: { staggerChildren: 0.03 } },
            }}
          >
            {filtered.map((concept, i) => (
              <motion.div key={concept.id} variants={{ show: { opacity: 1, y: 0 } }}>
                <ConceptCard
                  concept={concept}
                  masteryScore={masteryMap.get(concept.id)?.score}
                  onClick={() => onConceptClick(concept.id)}
                  compact
                  delay={i}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
