import { useState } from 'react';
import type { Member, Session } from '../../../shared/types';
import ParticipantPicker from './ParticipantPicker';

interface Props {
  members: Member[];
  initialData?: Session & { participantIds?: string[] };
  onSubmit: (data: {
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    notes: string;
    participant_member_ids: string[];
  }) => Promise<void>;
  onCreateMember?: (name: string) => Promise<Member>;
  submitLabel?: string;
  isLoading: boolean;
}

export default function SessionForm({
  members,
  initialData,
  onSubmit,
  onCreateMember,
  submitLabel = 'Create Session',
  isLoading,
}: Props) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || '');
  const [startTime, setStartTime] = useState(initialData?.start_time || '');
  const [endTime, setEndTime] = useState(initialData?.end_time || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialData?.participantIds || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title,
      date,
      start_time: startTime,
      end_time: endTime,
      location,
      notes,
      participant_member_ids: participantIds,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Friday Night Session"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date *
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Sports Hall A"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional info..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      {/* Participants */}
      <ParticipantPicker
        members={members}
        selected={participantIds}
        onChange={setParticipantIds}
        onCreateMember={onCreateMember}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !date}
        className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
