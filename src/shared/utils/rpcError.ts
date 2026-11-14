/** Turns "function does not exist" database errors into a clear instruction. */
export function friendlyRpcError(message: string, migration: string): Error {
  return new Error(
    /schema cache|does not exist|could not find the function|permission denied/i.test(message)
      ? `This needs a database update: run supabase/migrations/${migration} in the Supabase SQL Editor.`
      : message
  );
}
