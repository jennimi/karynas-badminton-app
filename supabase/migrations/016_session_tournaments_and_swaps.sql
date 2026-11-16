-- ============================================
-- 016: Session-Linked Tournaments & Mid-Tournament Player Swaps
-- ============================================

alter table tournaments
  add column if not exists session_id uuid references sessions(id) on delete set null;

create index if not exists idx_tournaments_session on tournaments(session_id);

create or replace function update_tournament_participant(
  p_participant_id uuid,
  p_player1_name text,
  p_player2_name text,
  p_member_id uuid default null,
  p_partner_member_id uuid default null
)
returns tournament_participants
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_clean_p1 text := btrim(coalesce(p_player1_name, ''));
  v_clean_p2 text := btrim(coalesce(p_player2_name, ''));
  v_updated tournament_participants;
begin
  if v_clean_p1 = '' or v_clean_p2 = '' then
    raise exception 'Both Player 1 and Player 2 names are required.';
  end if;

  if (p_member_id is not null and p_partner_member_id is not null and p_member_id = p_partner_member_id)
     or lower(v_clean_p1) = lower(v_clean_p2) then
    raise exception 'A player cannot be partnered with themselves on the same doubles team.';
  end if;

  update tournament_participants
  set
    player1_name = v_clean_p1,
    player2_name = v_clean_p2,
    member_id = p_member_id,
    partner_member_id = p_partner_member_id
  where id = p_participant_id
  returning * into v_updated;

  if v_updated.id is null then
    raise exception 'Tournament pair not found.';
  end if;

  return v_updated;
end;
$$;

grant execute on function update_tournament_participant(uuid, text, text, uuid, uuid) to anon, authenticated;
