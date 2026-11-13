import { useState } from 'react';
import { parseNames } from '../../../shared/utils/nameParser';

interface Props {
  onBulkAdd: (names: string[]) => Promise<{ added: number; skipped: string[] }>;
  isLoading: boolean;
}

export default function BulkAddMembers({ onBulkAdd, isLoading }: Props) {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<{
    added: number;
    skipped: string[];
  } | null>(null);

  const handleSubmit = async () => {
    const names = parseNames(text);
    if (names.length === 0) return;

    const res = await onBulkAdd(names);
    setResult(res);
    setText('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-primary hover:underline"
      >
        + Bulk add from text
      </button>
    );
  }

  const preview = text ? parseNames(text) : [];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Paste a list of names
        </span>
        <button
          onClick={() => {
            setIsOpen(false);
            setResult(null);
          }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        placeholder={`Paste names here, e.g.:\n1. Karyna\n2. Gavin\n3. Alex`}
        rows={5}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        disabled={isLoading}
      />

      {preview.length > 0 && (
        <p className="text-xs text-gray-500">
          Found {preview.length} name{preview.length !== 1 ? 's' : ''}:{' '}
          {preview.join(', ')}
        </p>
      )}

      {result && (
        <div className="text-sm">
          <p className="text-green-600">✓ Added {result.added} member{result.added !== 1 ? 's' : ''}</p>
          {result.skipped.length > 0 && (
            <p className="text-amber-600">
              Skipped (already exist): {result.skipped.join(', ')}
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isLoading || preview.length === 0}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Add {preview.length} member{preview.length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
