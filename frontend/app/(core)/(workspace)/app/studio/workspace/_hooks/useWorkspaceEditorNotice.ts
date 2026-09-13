import { useEffect, useState } from 'react';

export function useWorkspaceEditorNotice() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  return {
    notice,
    setNotice,
  };
}
