import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { useCurrentGroup } from '../../groups/hooks';
import { useAdmin } from '../useAdmin';
import { AdminDialog } from './AdminDialog';

/**
 * Unlock / lock admin mode from anywhere (sidebar and phone header). Admin mode shows the
 * extra controls: deleting, approving payments, setting costs. The database re-checks
 * the passcode for every one of those actions.
 */
export function AdminToggle() {
  const { data: group } = useCurrentGroup();
  const admin = useAdmin(group?.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      {admin.isAdmin ? (
        <Button size="sm" variant="secondary" onClick={admin.lock} aria-label="Admin mode is on. Lock it">
          <LockOpen />
          <span className="hidden lg:inline">Admin on</span>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          disabled={!group}
          aria-label="Unlock admin mode"
        >
          <Lock />
          <span className="hidden lg:inline">Admin</span>
        </Button>
      )}
      {open && group && <AdminDialog groupId={group.id} onClose={() => setOpen(false)} />}
    </>
  );
}
