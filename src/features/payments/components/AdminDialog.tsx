import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { checkAdminPasscode, hasAdminPasscode, setAdminPasscode } from '../api';
import { useAdmin } from '../useAdmin';

/** Unlock admin mode, or set the group's passcode the first time. */
export function AdminDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { unlock } = useAdmin(groupId);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data: hasCode, isLoading } = useQuery({
    queryKey: ['hasAdminPasscode', groupId],
    queryFn: () => hasAdminPasscode(groupId),
  });
  const creating = hasCode === false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (creating) {
        if (code.length < 4) throw new Error('Use at least 4 characters');
        if (code !== confirm) throw new Error('Passcodes don’t match');
        await setAdminPasscode(groupId, code);
        queryClient.invalidateQueries({ queryKey: ['hasAdminPasscode', groupId] });
        toast.success('Admin passcode set');
      } else if (!(await checkAdminPasscode(groupId, code))) {
        throw new Error('Wrong passcode');
      }
      unlock(code);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={creating ? 'Set an admin passcode' : 'Admin mode'}
      description={
        creating
          ? 'This group has no admin yet. The passcode lets you set prices and approve payments. Share it only with organisers.'
          : 'Enter the admin passcode to set prices and approve payments.'
      }
    >
      {isLoading ? null : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Passcode" htmlFor="admin-code">
            <Input
              id="admin-code"
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={!!error}
            />
          </Field>
          {creating && (
            <Field label="Repeat passcode" htmlFor="admin-code2">
              <Input
                id="admin-code2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}
          {error && (
            <p role="alert" className="text-sm font-bold text-coral-strong">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !code}>
              {busy ? 'Checking…' : creating ? 'Set passcode' : 'Unlock'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
