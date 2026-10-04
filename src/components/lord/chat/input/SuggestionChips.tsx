import { motion } from "framer-motion";
import { SUGGESTIONS } from "./suggestions";

export function SuggestionChips({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2 px-1">
      {SUGGESTIONS.map((s, i) => (
        <motion.button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.025, duration: 0.18, ease: "easeInOut" }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-foreground/75 transition-[border-color,color,background-color,transform] duration-200 hover:border-primary/35 hover:bg-primary/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          {s}
        </motion.button>
      ))}
    </div>
  );
}
