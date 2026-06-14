import { BadRequestException } from '@nestjs/common';

export const PROMPT_INJECTION_PATTERNS = [
  /ignore.*previous.*instructions/i,
  /system.*prompt/i,
  /output.*template/i,
  /disregard.*previous/i,
  /respond\s+in\s+plain\s+text/i,
  /forget\s+your\s+instructions/i,
  /you\s+are\s+now/i,
  /new\s+system\s+prompt/i,
];

export const PROMPT_SAFE_CHAR_WHITELIST = /[^\p{L}\p{N}\s,.\-'/&%()]/gu;

/**
 * Throws BadRequestException if the input matches any known prompt injection pattern.
 */
export function validatePromptSafety(input: string): void {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      throw new BadRequestException('Input contains blocked patterns');
    }
  }
}

/**
 * Truncates and restricts string characters to alpha-numeric, spaces,
 * and safe punctuation common to ingredients or style guides.
 */
export function sanitizePromptString(input: string, maxLength: number): string {
  const truncated = input.slice(0, maxLength);
  return truncated.replace(PROMPT_SAFE_CHAR_WHITELIST, '').trim();
}
