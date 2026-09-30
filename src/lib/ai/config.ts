import { PROVIDER_CONFIG } from "@/config/lord-config";

export interface AIConfig {
  openRouterApiKey: string;
}

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export function getAIConfig(): AIConfig {
  const apiKey = process.env[PROVIDER_CONFIG.openrouter.apiKeyEnv]?.trim();
  if (!apiKey) {
    throw new AIConfigurationError("OpenRouter API key is missing.");
  }

  return {
    openRouterApiKey: apiKey,
  };
}
