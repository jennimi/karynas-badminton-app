/**
 * Who is using this tab: the member they picked in "Who are you?" (features/members/useMe.ts keeps
 * that in sessionStorage under `me:<groupId>`). It is sent with every request so the activity log
 * (migration 017) can say who made a change. There is no login, so this is self-declared:
 * it is a label, never proof, and never a permission.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getActorId(): string | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('me:')) continue;
      const value = sessionStorage.getItem(key);
      if (value && UUID.test(value)) return value;
    }
  } catch {
    /* storage unavailable: changes are then logged as "Someone" */
  }
  return null;
}
