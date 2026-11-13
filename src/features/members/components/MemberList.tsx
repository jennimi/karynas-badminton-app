import { useState } from 'react';
import type { Member } from '../../../shared/types';

interface Props {
  members: Member[];
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export default function MemberList({ members, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  if (members.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No members yet. Add some above!
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400 mb-2">
        {members.length} member{members.length !== 1 ? 's' : ''}
      </p>
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group"
        >
          {editingId === member.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
              className="flex-1 flex gap-2"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onBlur={saveEdit}
              />
            </form>
          ) : (
            <>
              <span className="text-sm text-gray-800">{member.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(member)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(member.id)}
                  className="text-xs text-gray-400 hover:text-danger px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
