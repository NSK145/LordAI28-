import { PRICING_MAP } from "@/config/lord-config";

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_MAP.get(modelId);
  if (!pricing) return 0;
  const cost =
    (inputTokens * pricing.inputPer1MTokens + outputTokens * pricing.outputPer1MTokens) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

export function estimateImageCost(modelId: string): number {
  return PRICING_MAP.get(modelId)?.estimatedPricePerImage ?? 0;
}
