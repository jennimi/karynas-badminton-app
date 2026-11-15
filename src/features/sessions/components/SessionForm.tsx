import { useState, type FormEvent } from 'react';
import type { Member, Session } from '../../../shared/types';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Field } from '../../../shared/ui/field';
import { Input } from '../../../shared/ui/input';
import { todayString } from '../../../shared/utils/format';
import { Textarea } from '../../../shared/ui/textarea';
import ParticipantPicker from './ParticipantPicker';

export interface SessionFormData {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  /** undefined = not touched (lets the app work before migration 003 is run) */
  courts?: number | null;
  notes: string;
  participant_member_ids: string[];
}

interface Props {
  members: Member[];
  /** Values to start from: a whole session when editing, or just a few fields (e.g. from the Courts page). */
  initialData?: Partial<Session> & { participantIds?: string[] };
  onSubmit: (data: SessionFormData) => Promise<void>;
  onCancel: () => void;
  onCreateMember?: (name: string) => Promise<Member>;
  submitLabel?: string;
  isLoading: boolean;
}

export default function SessionForm({
  members,
  initialData,
  onSubmit,
  onCancel,
  onCreateMember,
  submitLabel = 'Create session',
  isLoading,
}: Props) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || todayString());
  const [startTime, setStartTime] = useState(initialData?.start_time?.slice(0, 5) || '');
  const [endTime, setEndTime] = useState(initialData?.end_time?.slice(0, 5) || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [courts, setCourts] = useState(initialData?.courts ? String(initialData.courts) : '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialData?.participantIds || []
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title: title.trim(),
      date,
      start_time: startTime,
      end_time: endTime,
      location: location.trim(),
      courts: courts ? Number(courts) : initialData?.id && initialData.courts ? null : undefined,
      notes: notes.trim(),
      participant_member_ids: participantIds,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title" htmlFor="s-title" hint="(optional)">
            <Input
              id="s-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Session"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date *" htmlFor="s-date">
              <Input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Start time" htmlFor="s-start">
              <Input id="s-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="End time" htmlFor="s-end">
              <Input id="s-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Location" htmlFor="s-location" className="sm:col-span-2">
              <Input
                id="s-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Sports Hall A"
              />
            </Field>
            <Field label="Courts booked" htmlFor="s-courts">
              <Input
                id="s-courts"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                value={courts}
                onChange={(e) => setCourts(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 2"
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="s-notes" hint="(optional)">
            <Textarea
              id="s-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Bring your own shuttlecocks, court fee, …"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ParticipantPicker
            members={members}
            selected={participantIds}
            onChange={setParticipantIds}
            onCreateMember={onCreateMember}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isLoading || !date}>
          {isLoading ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
