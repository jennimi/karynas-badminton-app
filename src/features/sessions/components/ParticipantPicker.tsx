import { useState, useMemo } from 'react';
import type { Member } from '../../../shared/types';
import { parseNames, matchNames } from '../../../shared/utils/nameParser';

interface Props {
  members: Member[];
  selected: string[]; // member IDs
  onChange: (ids: string[]) => void;
  onCreateMember?: (name: string) => Promise<Member>;
}

export default function ParticipantPicker({
  members,
  selected,
  onChange,
  onCreateMember,
}: Props) {
  const [search, setSearch] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    added: string[];
    created: string[];
    notFound: string[];
  } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return members;
    const lower = search.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(lower));
  }, [members, search]);

  const toggle = (memberId: string) => {
    if (selected.includes(memberId)) {
      onChange(selected.filter((id) => id !== memberId));
    } else {
      onChange([...selected, memberId]);
    }
  };

  const selectAll = () => onChange(members.map((m) => m.id));
  const clearAll = () => onChange([]);

  const handleBulkAdd = async () => {
    const names = parseNames(bulkText);
    if (names.length === 0) return;

    const results = matchNames(names, members);
    const newSelected = [...selected];
    const added: string[] = [];
    const created: string[] = [];
    const notFound: string[] = [];

    for (const result of results) {
      if (result.match) {
        // Exact match — select them
        if (!newSelected.includes(result.match.id)) {
          newSelected.push(result.match.id);
          added.push(result.match.name);
        }
      } else if (result.suggestions.length === 1) {
        // Single close match — use it
        const suggestion = result.suggestions[0];
        if (!newSelected.includes(suggestion.id)) {
          newSelected.push(suggestion.id);
          added.push(`${result.name} → ${suggestion.name}`);
        }
      } else if (onCreateMember) {
        // No match — create a new member
        try {
          const newMember = await onCreateMember(result.name);
          newSelected.push(newMember.id);
          created.push(result.name);
        } catch {
          notFound.push(result.name);
        }
      } else {
        notFound.push(result.name);
      }
    }

    onChange(newSelected);
    setBulkResult({ added, created, notFound });
    setBulkText('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Participants ({selected.length}/{members.length})
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-400 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      />

      {/* Member checkboxes */}
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No members found
          </p>
        ) : (
          filtered.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(member.id)}
                onChange={() => toggle(member.id)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-800">{member.name}</span>
            </label>
          ))
        )}
      </div>

      {/* Bulk add */}
      <div>
        {!showBulk ? (
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            className="text-sm text-primary hover:underline"
          >
            + Add from pasted list
          </button>
        ) : (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Paste names to add as participants
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowBulk(false);
                  setBulkResult(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setBulkResult(null);
              }}
              placeholder={`Paste names here...\nUnknown names will be created as new members.`}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />

            {bulkResult && (
              <div className="text-xs space-y-1">
                {bulkResult.added.length > 0 && (
                  <p className="text-green-600">
                    ✓ Matched: {bulkResult.added.join(', ')}
                  </p>
                )}
                {bulkResult.created.length > 0 && (
                  <p className="text-blue-600">
                    + Created: {bulkResult.created.join(', ')}
                  </p>
                )}
                {bulkResult.notFound.length > 0 && (
                  <p className="text-amber-600">
                    ? Not found: {bulkResult.notFound.join(', ')}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={!bulkText.trim()}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Match & Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
