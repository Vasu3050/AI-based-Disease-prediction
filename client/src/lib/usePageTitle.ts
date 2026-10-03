import { useEffect } from 'react';

/** Set the document title for a page. */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · MediPredict AI` : 'MediPredict AI';
    return () => {
      document.title = 'MediPredict AI';
    };
  }, [title]);
}
