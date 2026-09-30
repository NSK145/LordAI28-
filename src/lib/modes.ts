import type { ComponentType } from "react";
import { Zap, Scale, Code2, Palette, Brain, Smartphone } from "lucide-react";
import {
  LORD_IDENTITY,
  LORD_MODES as CONFIGURED_LORD_MODES,
  LORD_MODE_DESCRIPTIONS,
  LORD_MODE_LABELS,
} from "@/config/lord-config";
import type { LordMode } from "@/config/lord-config";

export type { LordMode } from "@/config/lord-config";

// Client-side capability modes. The frontend only knows about these — the
// underlying model ids live on the server (see LORD_MODELS in lord-config.ts).
export interface LordModeDef {
  id: LordMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const MODE_ICONS: Readonly<Record<LordMode, ComponentType<{ className?: string }>>> = {
  fast: Zap,
  balanced: Scale,
  coding: Code2,
  creative: Palette,
  reasoning: Brain,
  local: Smartphone,
};

export const LORD_MODES: readonly LordModeDef[] = Object.freeze(
  CONFIGURED_LORD_MODES.map((id) => ({
    id,
    label: LORD_MODE_LABELS[id],
    description: LORD_MODE_DESCRIPTIONS[id],
    icon: MODE_ICONS[id],
  })),
);

export const DEFAULT_MODE: LordMode = LORD_IDENTITY.defaultMode;

export function modeLabel(mode: string): string {
  return mode in LORD_MODE_LABELS ? LORD_MODE_LABELS[mode as LordMode] : mode;
}

export function getModeDef(mode: string): LordModeDef | undefined {
  return LORD_MODES.find((m) => m.id === mode);
}
