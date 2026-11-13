import { supabase } from '../../shared/supabase';
import type { PaymentStatus } from '../../shared/types';

// All writes go through database functions that check the admin passcode
// server-side (see supabase/migrations/004_session_payments.sql).

export async function hasAdminPasscode(groupId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_admin_passcode', { p_group: groupId });
  if (error) throw error;
  return !!data;
}

export async function checkAdminPasscode(groupId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_admin_passcode', {
    p_group: groupId,
    p_code: code,
  });
  if (error) throw error;
  return !!data;
}

export async function setAdminPasscode(groupId: string, next: string, current?: string) {
  const { error } = await supabase.rpc('set_admin_passcode', {
    p_group: groupId,
    p_new: next,
    p_current: current ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function setSessionCost(sessionId: string, cost: number | null, code: string) {
  const { error } = await supabase.rpc('set_session_cost', {
    p_session: sessionId,
    p_cost: cost,
    p_code: code,
  });
  if (error) throw new Error(error.message);
}

/** Admin: move everyone in `from` to `to` for one session. Returns how many changed. */
export async function bulkSetPaymentStatus(
  sessionId: string,
  from: PaymentStatus,
  to: PaymentStatus,
  code: string
): Promise<number> {
  const { data, error } = await supabase.rpc('bulk_set_payment_status', {
    p_session: sessionId,
    p_from: from,
    p_to: to,
    p_code: code,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function setPaymentStatus(
  participantId: string,
  status: PaymentStatus,
  code?: string | null
) {
  const { error } = await supabase.rpc('set_payment_status', {
    p_participant: participantId,
    p_status: status,
    p_code: code ?? null,
  });
  if (error) throw new Error(error.message);
}
