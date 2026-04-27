// Reactive RxDB query hooks for wiki content. Re-render when the underlying
// collection changes (server fan-out lands new pages, user edits a section).

import { useEffect, useState } from 'react';
import { getDatabase } from './database';
import type { WikiPageDoc, WikiSectionDoc } from './schemas';

export function useWikiPages(): WikiPageDoc[] {
  const [pages, setPages] = useState<WikiPageDoc[]>([]);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    let cancelled = false;

    void getDatabase().then((db) => {
      if (cancelled) return;
      sub = db.collections.wiki_pages
        .find({
          selector: { tombstoned_at: null, scope: 'user' },
          sort: [{ updated_at: 'desc' }],
        })
        // biome-ignore lint/suspicious/noExplicitAny: RxDocument type is narrow; toJSON returns the typed doc shape
        .$.subscribe((docs: any[]) => {
          setPages(docs.map((d) => d.toJSON() as WikiPageDoc));
        });
    });

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, []);

  return pages;
}

export function useWikiSectionsForPage(pageId: string | null): WikiSectionDoc[] {
  const [sections, setSections] = useState<WikiSectionDoc[]>([]);

  useEffect(() => {
    if (!pageId) {
      setSections([]);
      return;
    }
    let sub: { unsubscribe: () => void } | undefined;
    let cancelled = false;

    void getDatabase().then((db) => {
      if (cancelled) return;
      sub = db.collections.wiki_sections
        .find({
          selector: { page_id: pageId, tombstoned_at: null },
          sort: [{ sort_order: 'asc' }],
        })
        // biome-ignore lint/suspicious/noExplicitAny: same as above
        .$.subscribe((docs: any[]) => {
          setSections(docs.map((d) => d.toJSON() as WikiSectionDoc));
        });
    });

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [pageId]);

  return sections;
}
