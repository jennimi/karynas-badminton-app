import { useQueryClient } from '@tanstack/react-query';
import { Check, Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { useCurrentGroup } from '../../../features/groups/hooks';
import { AdminDialog } from '../../../features/payments/components/AdminDialog';
import { useAdmin } from '../../../features/payments/useAdmin';
import { RallyLogo, RallyMark } from './RallyLogo';
import { RALLY_ICONS, iconSrc, saveAppIcon, useRallyIcon, type RallyIconId } from './rallyIcons';

/**
 * Pick which of the 12 Rally icons the whole app uses. Click an icon to preview it (light and
 * dark, as the logo, as the loading hop, and tiny); "Use for everyone" saves it (admin passcode).
 */
export function IconPicker() {
  const queryClient = useQueryClient();
  const current = useRallyIcon();
  const { data: group } = useCurrentGroup();
  const admin = useAdmin(group?.id);
  const [picked, setPicked] = useState<RallyIconId | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const shown = picked ?? current;
  const changed = picked !== null && picked !== current;
  const label = RALLY_ICONS.find((i) => i.id === shown)?.label;

  const save = async () => {
    if (!group || !admin.code || !picked) return;
    setSaving(true);
    try {
      await saveAppIcon(group.id, picked, admin.code);
      queryClient.setQueryData(['appIcon'], picked);
      setPicked(null);
      toast.success('Icon changed for everyone');
    } catch (e) {
      const msg = (e as Error).message;
      if (/passcode/i.test(msg)) admin.lock();
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Rally icon</CardTitle>
        <div className="flex items-center gap-2">
          {admin.isAdmin ? (
            <Button size="sm" variant="secondary" onClick={admin.lock}>
              <LockOpen /> Admin on · Lock
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setUnlocking(true)} disabled={!group}>
              <Lock /> Unlock admin to change
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Pick one of the 12 icons. It’s used for the sidebar logo, the loading screens and the browser tab.
          Click to preview, then save: it changes for everyone and needs the admin passcode.
        </p>

        <div role="radiogroup" aria-label="Rally icon" className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {RALLY_ICONS.map((i, n) => {
            const selected = shown === i.id;
            return (
              <button
                key={i.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPicked(i.id === current ? null : i.id)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  selected ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-muted'
                )}
              >
                <img src={iconSrc(i.id)} alt="" width={72} height={72} loading="lazy" draggable={false} />
                <span className="text-xs font-bold leading-tight">
                  {n + 1}. {i.label}
                </span>
                {current === i.id && <Badge variant="lime">In use</Badge>}
              </button>
            );
          })}
        </div>

        {/* preview of the highlighted icon */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[false, true].map((dark) => (
            <div
              key={String(dark)}
              className={cn(
                dark && 'dark',
                'flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-5 text-foreground'
              )}
            >
              <RallyMark icon={shown} size={88} motion="loop" label={`Rally icon: ${label}`} />
              <RallyLogo icon={shown} size={40} motion="hover" />
              <div className="flex items-end gap-4">
                {[16, 24, 32, 48].map((s) => (
                  <RallyMark key={s} icon={shown} size={s} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!changed || !admin.isAdmin || saving}>
            <Check /> {saving ? 'Saving…' : 'Use for everyone'}
          </Button>
          {changed && !admin.isAdmin && (
            <span className="text-xs font-semibold text-butter-strong">Unlock admin mode to save this choice.</span>
          )}
          {!changed && <span className="text-xs text-muted-foreground">“{label}” is in use.</span>}
          {changed && (
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              Back to the one in use
            </Button>
          )}
        </div>
      </CardContent>
      {unlocking && group && <AdminDialog groupId={group.id} onClose={() => setUnlocking(false)} />}
    </Card>
  );
}
