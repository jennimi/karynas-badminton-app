import { useState } from 'react';

interface Props {
  onAdd: (name: string) => Promise<void>;
  isLoading: boolean;
}

export default function AddMemberForm({ onAdd, isLoading }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter member name"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !name.trim()}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Add
      </button>
    </form>
  );
}
