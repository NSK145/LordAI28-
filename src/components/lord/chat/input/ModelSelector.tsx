import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LORD_MODES, type LordMode } from "@/lib/modes";

interface ModeSelectorProps {
  value: LordMode;
  onChange: (value: LordMode) => void;
}

export function ModelSelector({ value, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (mode: LordMode) => {
      onChange(mode);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const selected = LORD_MODES.find((m) => m.id === value) ?? LORD_MODES[1];
  const SelectedIcon = selected.icon;

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:border-cyan-400/40 hover:text-cyan-200"
        aria-label="Select mode"
      >
        <SelectedIcon className="h-3.5 w-3.5 text-cyan-300" />
        <span className="font-medium">{selected.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,20,28,0.92)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            {LORD_MODES.map((m) => {
              const active = m.id === value;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition",
                    active
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-[10px] text-white/40">{m.description}</span>
                  </span>
                  {active && <Check className="ml-auto h-4 w-4 text-cyan-300" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
