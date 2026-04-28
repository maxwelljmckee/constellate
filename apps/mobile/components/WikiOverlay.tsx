import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRxdbReady } from '../lib/rxdb/useRxdbReady';
import { useWikiPages } from '../lib/rxdb/useWikiPages';
import type { WikiPageDoc } from '../lib/rxdb/schemas';
import { PluginOverlay } from './PluginOverlay';
import { WikiPageDetail } from './WikiPageDetail';

const TYPE_LABELS: Record<string, string> = {
  person: 'People',
  concept: 'Concepts',
  project: 'Projects',
  place: 'Places',
  org: 'Orgs',
  source: 'Sources',
  event: 'Events',
  note: 'Notes',
  profile: 'Profile',
  todo: 'Todos',
};

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  person: 'people-outline',
  concept: 'bulb-outline',
  project: 'briefcase-outline',
  place: 'location-outline',
  org: 'business-outline',
  source: 'document-text-outline',
  event: 'calendar-outline',
  note: 'create-outline',
  profile: 'person-circle-outline',
  todo: 'checkbox-outline',
};

type WikiView = 'folders' | 'type' | 'todo-bucket' | 'page';

export function WikiOverlay() {
  const ready = useRxdbReady();
  const pages = useWikiPages();
  const [view, setView] = useState<WikiView>('folders');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, WikiPageDoc[]>();
    for (const p of pages) {
      const list = m.get(p.type) ?? [];
      list.push(p);
      m.set(p.type, list);
    }
    return [...m.entries()]
      .map(([type, items]) => ({ type, items }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [pages]);

  function openType(type: string) {
    setActiveType(type);
    setView('type');
  }

  function openPage(id: string) {
    setActivePageId(id);
    setView('page');
  }

  function openBucket(bucketId: string) {
    setActiveBucketId(bucketId);
    setView('todo-bucket');
  }

  function back() {
    if (view === 'page') {
      // Back from a page goes to whichever list view we drilled in from.
      setView(activeBucketId ? 'todo-bucket' : 'type');
      setActivePageId(null);
    } else if (view === 'todo-bucket') {
      setView('type');
      setActiveBucketId(null);
    } else if (view === 'type') {
      setView('folders');
      setActiveType(null);
    }
  }

  const activePage = activePageId ? pages.find((p) => p.id === activePageId) ?? null : null;
  const typeItems = activeType ? groups.find((g) => g.type === activeType)?.items ?? [] : [];
  const activeBucket = activeBucketId
    ? pages.find((p) => p.id === activeBucketId) ?? null
    : null;
  const bucketChildren = activeBucketId
    ? pages.filter((p) => p.parent_page_id === activeBucketId)
    : [];

  return (
    <PluginOverlay kind="wiki" title="Wiki">
      {!ready ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Syncing your wiki…</Text>
        </View>
      ) : view === 'folders' ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.type}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No pages yet. Have a call with Audri and your wiki will start to populate.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openType(item.type)}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={TYPE_ICONS[item.type] ?? 'document-outline'}
                  size={20}
                  color="#7aa3d4"
                />
              </View>
              <Text style={styles.rowLabel}>
                {TYPE_LABELS[item.type] ?? item.type}
              </Text>
              <Text style={styles.rowCount}>{item.items.length}</Text>
              <Ionicons name="chevron-forward" size={18} color="#3f5a83" />
            </Pressable>
          )}
        />
      ) : view === 'type' ? (
        <View style={styles.flex}>
          <Pressable style={styles.backRow} onPress={back}>
            <Ionicons name="chevron-back" size={20} color="#7aa3d4" />
            <Text style={styles.backLabel}>Wiki</Text>
          </Pressable>
          {activeType === 'todo' ? (
            <TodoBucketFolders
              items={typeItems}
              onOpenBucket={openBucket}
            />
          ) : (
            <FlatList
              data={typeItems}
              keyExtractor={(p) => p.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => openPage(item.id)}>
                  <View style={styles.pageRowMain}>
                    <Text style={styles.pageRowTitle}>{item.title}</Text>
                    <Text style={styles.pageRowAbstract} numberOfLines={2}>
                      {item.agent_abstract}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#3f5a83" />
                </Pressable>
              )}
            />
          )}
        </View>
      ) : view === 'todo-bucket' && activeBucket ? (
        <View style={styles.flex}>
          <Pressable style={styles.backRow} onPress={back}>
            <Ionicons name="chevron-back" size={20} color="#7aa3d4" />
            <Text style={styles.backLabel}>Todos</Text>
          </Pressable>
          <Text style={styles.bucketTitle}>
            {TODO_BUCKET_LABELS[activeBucket.slug] ?? activeBucket.title}
          </Text>
          <FlatList
            data={bucketChildren}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No todos here yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => openPage(item.id)}>
                <View style={styles.pageRowMain}>
                  <Text style={styles.pageRowTitle}>{item.title}</Text>
                  <Text style={styles.pageRowAbstract} numberOfLines={2}>
                    {item.agent_abstract}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#3f5a83" />
              </Pressable>
            )}
          />
        </View>
      ) : view === 'page' && activePage ? (
        <WikiPageDetail page={activePage} onBack={back} />
      ) : null}
    </PluginOverlay>
  );
}

// Bucket slugs for todos. Order = display order in the nested list.
const TODO_BUCKET_SLUGS = ['todos/todo', 'todos/in-progress', 'todos/done', 'todos/archived'] as const;
const TODO_BUCKET_LABELS: Record<string, string> = {
  'todos/todo': 'To do',
  'todos/in-progress': 'In progress',
  'todos/done': 'Done',
  'todos/archived': 'Archived',
};

// Each todo bucket renders as a drillable folder row (synthetic
// directory). Tapping a bucket pushes a new view that lists only that
// bucket's children. Bucket pages themselves and the `todos` root page
// are NOT shown as items — they're structural, not content.
function TodoBucketFolders({
  items,
  onOpenBucket,
}: {
  items: WikiPageDoc[];
  onOpenBucket: (bucketId: string) => void;
}) {
  const bucketBySlug = new Map(
    items
      .filter((p) => (TODO_BUCKET_SLUGS as readonly string[]).includes(p.slug))
      .map((b) => [b.slug, b]),
  );

  const childCountByBucketId = new Map<string, number>();
  for (const p of items) {
    if (!p.parent_page_id) continue;
    if ((TODO_BUCKET_SLUGS as readonly string[]).includes(p.slug)) continue;
    if (p.slug === 'todos') continue;
    childCountByBucketId.set(
      p.parent_page_id,
      (childCountByBucketId.get(p.parent_page_id) ?? 0) + 1,
    );
  }

  return (
    <FlatList
      data={TODO_BUCKET_SLUGS as readonly string[]}
      keyExtractor={(slug) => slug}
      contentContainerStyle={styles.list}
      renderItem={({ item: slug }) => {
        const bucket = bucketBySlug.get(slug);
        if (!bucket) return null;
        const count = childCountByBucketId.get(bucket.id) ?? 0;
        return (
          <Pressable style={styles.row} onPress={() => onOpenBucket(bucket.id)}>
            <View style={styles.rowIcon}>
              <Ionicons name="folder-outline" size={20} color="#7aa3d4" />
            </View>
            <Text style={styles.rowLabel}>{TODO_BUCKET_LABELS[slug]}</Text>
            <Text style={styles.rowCount}>{count}</Text>
            <Ionicons name="chevron-forward" size={18} color="#3f5a83" />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#7aa3d4' },
  list: { paddingVertical: 8 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: {
    color: '#7aa3d4',
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11203a',
  },
  rowLabel: { flex: 1, color: '#e8f1ff', fontSize: 15, fontWeight: '500' },
  rowCount: { color: '#7aa3d4', fontSize: 13 },
  pageRowMain: { flex: 1, gap: 4 },
  pageRowTitle: { color: '#e8f1ff', fontSize: 15, fontWeight: '500' },
  pageRowAbstract: { color: '#7aa3d4', fontSize: 13, lineHeight: 17 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  backLabel: { color: '#7aa3d4', fontSize: 15 },
  bucketTitle: {
    color: '#e8f1ff',
    fontSize: 22,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
