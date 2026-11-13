import type { Member } from '../types';

// Invisible / "format" characters that String.trim() does not remove:
// zero-width space/joiners, LTR/RTL marks, BOM, soft hyphen, word joiner, etc.
const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
// Every kind of space (NBSP, thin space, ideographic space, ...) -> normal space
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\t]/g;
// Emoji, pictographs, dingbats, check marks, keycaps
const EMOJI = /[\p{Extended_Pictographic}\u20E3\u{1F3FB}-\u{1F3FF}\u2713\u2714\u2705\u2611\u2610\u274C\u274E]/gu;

/**
 * Clean ONE name: strips invisible characters, odd spaces, emoji, list
 * numbering/bullets, and collapses repeated spaces. Always safe to call.
 */
export function cleanName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(ODD_SPACES, ' ')
    .replace(EMOJI, '')
    // numbering: "1.", "1)", "1:", "1 -"
    .replace(/^\s*\d+\s*[.):\-]\s*/, '')
    // bullets: "- ", "• ", "* ", "– "
    .replace(/^\s*[-•*–—·▪●○◦]\s*/, '')
    // trailing decoration like " -" or ":"
    .replace(/[\s:;,\-–—]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Key used to compare names: case-, accent- and spacing-insensitive. */
export function nameKey(name: string): string {
  return cleanName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Parse a block of pasted text into individual names.
 * Handles one per line, numbering, bullets, commas/semicolons, emoji and
 * invisible characters. Empty lines are skipped.
 */
export function parseNames(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n|\u2028|\u2029/);
  // Split on commas/semicolons only when the list is not already one per line
  const parts =
    lines.filter((l) => l.trim()).length <= 1 ? text.split(/[,;，、]/) : lines;
  return parts.map(cleanName).filter((n) => n.length > 0);
}

/** Remove repeated names (case/space-insensitive); reports what was dropped. */
export function dedupeNames(names: string[]): { unique: string[]; repeated: string[] } {
  const seen = new Set<string>();
  const unique: string[] = [];
  const repeated: string[] = [];
  for (const n of names) {
    const k = nameKey(n);
    if (seen.has(k)) repeated.push(n);
    else {
      seen.add(k);
      unique.push(n);
    }
  }
  return { unique, repeated };
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
    const lower = nameKey(name);

    // Exact match (case-insensitive)
    const exactMatch = existingMembers.find(
      (m) => nameKey(m.name) === lower
    );

    if (exactMatch) {
      return { name, match: exactMatch, suggestions: [] };
    }

    // Partial match: name contains member name or vice versa
    const suggestions = existingMembers.filter((m) => {
      const memberLower = nameKey(m.name);
      return (
        memberLower.includes(lower) ||
        lower.includes(memberLower)
      );
    });

    return { name, match: null, suggestions };
  });
}
