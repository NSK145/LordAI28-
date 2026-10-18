import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Cpu, Eye, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LORD_MODES, type LordMode } from "@/lib/modes";
import { FREE_CHAT_MODELS } from "@/lib/ai/chat-model-catalog";

interface ModeSelectorProps {
  value: LordMode;
  onChange: (value: LordMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
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

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = FREE_CHAT_MODELS.find((model) => model.id === value) ?? FREE_CHAT_MODELS[0];

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        onClick={() => setOpen((current) => !current)}
        whileTap={{ scale: 0.96 }}
        className="flex max-w-52 items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:border-cyan-400/40 hover:text-cyan-200"
        aria-label={`Select AI model, current model ${selected.label}`}
        aria-expanded={open}
      >
        <Cpu className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
        <span className="truncate font-medium">{selected.label}</span>
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")}
        />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,20,28,0.97)] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div className="border-b border-white/10 px-2 pb-2">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Choose a model</span>
                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                  Free tier
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                Free access is quota-limited. Models may be busy or temporarily unavailable; limits
                vary by provider.
              </p>
            </div>
            <div className="mt-1 max-h-[min(55vh,25rem)] overflow-y-auto">
              {FREE_CHAT_MODELS.map((model) => {
                const active = model.id === selected.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
                      active
                        ? "bg-cyan-400/10 text-cyan-100"
                        : "text-white/75 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">{model.label}</span>
                        {model.vision && (
                          <Eye className="h-3 w-3 shrink-0 text-violet-300" aria-label="Vision" />
                        )}
                        {model.reasoning && (
                          <Sparkles
                            className="h-3 w-3 shrink-0 text-amber-300"
                            aria-label="Reasoning"
                          />
                        )}
                        {model.coding && (
                          <Zap className="h-3 w-3 shrink-0 text-sky-300" aria-label="Coding" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-white/40">
                        {model.providerLabel} · {model.capabilities}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-amber-200/70">
                        Free tier · may be busy
                      </span>
                    </span>
                    {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/10 px-2 pt-2 text-[10px] leading-relaxed text-white/40">
              Paid models are not included. Availability and quotas are controlled by the provider.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
