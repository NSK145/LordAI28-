import { formatUserFacingError, parseLordError } from "../lord-error";

const HTML_PAGE = /<!doctype\s+html|<html[\s>]|<body[\s>]|<title[\s>]/i;
const SERVER_TRACE =
  /(?:\bat\s+[\w$.<>]+\s*\(|\b(stack trace|internal server error|uncaught exception)\b)/i;

export function isUnsafeAssistantError(value: string): boolean {
  return HTML_PAGE.test(value) || SERVER_TRACE.test(value);
}

export function safeChatErrorMessage(value: string | undefined): string {
  if (!value || isUnsafeAssistantError(value)) {
    return "LORD AI couldn’t complete that response. Check your connection and try again.";
  }
  const lordError = parseLordError(value);
  if (lordError) return formatUserFacingError(lordError);
  return value.length > 500 ? "LORD AI couldn’t complete that response. Please try again." : value;
}
