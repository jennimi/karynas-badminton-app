import type { Member } from '../types';

/**
 * Parse a block of pasted text into individual names.
 * Handles:
 *  - One name per line
 *  - Numbered lists: "1. Karyna", "2) Gavin"
 *  - Bullet points: "- Karyna", "• Gavin"
 *  - Comma-separated: "Karyna, Gavin, Alex"
 *  - Emoji and trailing whitespace: "Karyna ✅"
 *  - Empty lines are skipped
 */
export function parseNames(text: string): string[] {
  // Split by newlines first
  let lines = text.split(/\n/);

  // If only one line, try splitting by comma
  if (lines.length === 1) {
    lines = text.split(/,/);
  }

  return lines
    .map((line) => {
      return (
        line
          // Remove numbering: "1.", "1)", "1:"
          .replace(/^\s*\d+[.):\-]\s*/, '')
          // Remove bullet points: "- ", "• ", "* "
          .replace(/^\s*[-•*]\s*/, '')
          // Remove common emojis and check marks
          .replace(/[✅✓☑️❌⭐🏸]/g, '')
          // Trim whitespace
          .trim()
      );
    })
    .filter((name) => name.length > 0);
}

export interface NameMatchResult {
  name: string;
  match: Member | null; // Exact match (case-insensitive)
  suggestions: Member[]; // Close matches
}

/**
 * Match parsed names against existing members.
 * - Exact match (case-insensitive) → match
 * - Partial match (one name contains the other) → suggestions
 * - No match → null match, no suggestions
 */
export function matchNames(
  names: string[],
  existingMembers: Member[]
): NameMatchResult[] {
  return names.map((name) => {
    const lower = name.toLowerCase();

    // Exact match (case-insensitive)
    const exactMatch = existingMembers.find(
      (m) => m.name.toLowerCase() === lower
    );

    if (exactMatch) {
      return { name, match: exactMatch, suggestions: [] };
    }

    // Partial match: name contains member name or vice versa
    const suggestions = existingMembers.filter((m) => {
      const memberLower = m.name.toLowerCase();
      return (
        memberLower.includes(lower) ||
        lower.includes(memberLower)
      );
    });

    return { name, match: null, suggestions };
  });
}
