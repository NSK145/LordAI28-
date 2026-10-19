/** Extensible, deterministic routing before a message enters the chat gateway. */
const IMAGE_PATTERNS = [
  /\b(draw|paint|sketch|render|illustrate|visualize)\b/i,
  /\b(generate|create|make|draw|paint|design)\b.{0,100}\b(image|picture|visual|artwork|logo|icon|poster|wallpaper|avatar|thumbnail|illustration|scene|art|photo|portrait)\b/i,
  /\b(generate|create|make)\b.{0,80}\b(city|landscape|character|creature|cat|dog|person|kid|child|animal|forest|building|room|vehicle|dragon|robot|spaceship|mountain|ocean)\b/i,
  /\b(image|picture|wallpaper|poster|illustration|artwork|logo|portrait)\b.{0,50}\b(for|of|with|showing|featuring)\b/i,
  /\b(generate|create|make)\s+(?:four|[2-6])\s+variations?\b/i,
  /\b(make|turn|transform|convert|restyle)\s+(?:this|the|an?\s+image|it)\b/i,
  /\b(remove|replace|change|erase|edit|extend|expand|upscale|enhance|recolor)\b.{0,80}\b(background|object|person|image|style|resolution|quality|canvas)\b/i,
  /\b(remove the background|background removal|transparent background|outpaint|inpaint|image variation|image variations)\b/i,
];

const CHAT_GUARDS = [
  /\b(explain|describe|history of|what is|how does|why does)\b/i,
  /^\s*(?:can|could|do|does|is|are)\s+(?:you|lord\s*ai|this app)\b.{0,80}\b(?:generate|make|create|draw)\s+(?:ai\s+)?images?\s*\??\s*$/i,
];

export function detectImageIntent(text: string): boolean {
  const normalized = text.trim();
  if (!normalized || CHAT_GUARDS.some((pattern) => pattern.test(normalized))) return false;
  return IMAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Defensive UI check for a provider/model leaking its private tool protocol. */
export function isInternalImageToolPayload(text: string): boolean {
  return /<\/?dots_function_call\b|<invoke\s+name\s*=\s*["']image_generation["']/i.test(text);
}
