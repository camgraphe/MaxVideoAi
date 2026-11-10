'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { compactLibraryCopy } from './compact-library-copy';

export function LibraryCollectionCreate({ locale, pending, onCreate, submitLabel }: {
  locale: string;
  pending: boolean;
  onCreate: (name: string) => Promise<boolean>;
  submitLabel?: string;
}) {
  const copy = compactLibraryCopy(locale);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const length = Array.from(name.trim()).length;
  return <div className="compact-library-collection-create">
    <button type="button" disabled={pending} aria-expanded={editing} onClick={() => setEditing(value => !value)}>
      <Plus size={16} aria-hidden />{copy.newCollection}
    </button>
    {editing ? <form onSubmit={async event => {
      event.preventDefault();
      if (await onCreate(name)) { setName(''); setEditing(false); }
    }}>
      <label>{copy.collectionName}<input autoFocus value={name} maxLength={240} onChange={event => setName(event.target.value)} disabled={pending} /></label>
      <button type="submit" disabled={pending || length === 0 || length > 120}>{submitLabel ?? copy.create}</button>
    </form> : null}
  </div>;
}
