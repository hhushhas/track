import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonRow } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { groupMobileTasksByState, taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';

type TaskView = {
  task: Doc<'tasks'>;
  state: Doc<'taskWorkflowStates'> | null;
  assignee: Doc<'projectMembers'> | null;
};

type BoardView = { board: Doc<'taskBoards'>; states: Array<Doc<'taskWorkflowStates'>> };
type SuggestionView = {
  suggestion: Doc<'taskSuggestions'>;
  references: Array<Doc<'taskSuggestionReferences'>>;
  canDismiss: boolean;
  possibleDuplicateTask: { _id: Id<'tasks'>; publicKey: string; title: string } | null;
  proposedAssignee: { user: { displayName: string }; company: Doc<'companies'> | null } | null;
};

type TaskTab = 'board' | 'my' | 'all' | 'inbox';
const priorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;

function readableError(failure: unknown) {
  if (!(failure instanceof Error)) return 'The task action failed.';
  if (failure.message.includes('task_access_changed')) return 'Your access changed. Refresh and try again.';
  if (failure.message.includes('task_duplicate_decision_required')) return 'Choose whether to add a reference or create a separate task.';
  return failure.message.replaceAll('_', ' ');
}

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const release = useReleaseConfig();
  const { projectId, companyId, membershipId, archive } = useLocalSearchParams<{
    projectId: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
  }>();
  const project = projectId as Id<'projects'>;
  const identity: MobileTaskIdentity | null = companyId && membershipId ? {
    archived: archive === '1',
    companyId: companyId as Id<'companies'>,
    membershipId: membershipId as Id<'projectMembers'>,
  } : null;
  const queryIdentity = identity ? {
    actingCompanyId: identity.companyId,
    projectMemberId: identity.membershipId,
  } : {};
  const readOnly = archive === '1';
  const currentUser = useQuery(api.auth.getCurrentUser);
  const boards = useQuery(api.taskBoards.list, release.tasks ? { projectId: project, ...queryIdentity } : 'skip') as BoardView[] | undefined;
  const assignees = useQuery(api.tasks.listEligibleAssignees, release.tasks && !readOnly ? { projectId: project, ...queryIdentity } : 'skip');
  const currentMemberId = identity?.membershipId ?? assignees?.find((item) => item.user._id === currentUser?._id)?.member._id;
  const [tab, setTab] = useState<TaskTab>('board');
  const [boardId, setBoardId] = useState<string>('');
  const selectedBoard = boards?.find((item) => item.board._id === boardId) ?? boards?.find((item) => item.board.isDefault) ?? boards?.[0];
  const tasks = useQuery(api.tasks.list, release.tasks && tab !== 'inbox' ? {
    projectId: project,
    boardId: tab === 'board' ? selectedBoard?.board._id : undefined,
    assigneeProjectMemberId: tab === 'my' ? currentMemberId : undefined,
    ...queryIdentity,
  } : 'skip') as TaskView[] | undefined;
  const suggestions = useQuery(api.taskSuggestions.list, release.tasks && tab === 'inbox' && !readOnly ? {
    projectId: project,
    ...queryIdentity,
  } : 'skip') as SuggestionView[] | undefined;
  const createTask = useMutation(api.tasks.create);
  const acceptSuggestion = useMutation(api.taskSuggestions.accept);
  const dismissSuggestion = useMutation(api.taskSuggestions.dismiss);
  const hideSuggestion = useMutation(api.taskSuggestions.hide);
  const linkSuggestion = useMutation(api.taskSuggestions.linkToExisting);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof priorities)[number]>('none');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => selectedBoard
    ? groupMobileTasksByState(selectedBoard.states.map((state) => state._id), tasks ?? [])
    : [], [selectedBoard, tasks]);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await createTask({
        projectId: project,
        boardId: selectedBoard?.board._id,
        title,
        description: description.trim() || undefined,
        priority,
        idempotencyKey: `${Date.now()}-${Math.random()}`,
        ...queryIdentity,
      });
      hapticMedium();
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      router.push(taskDetailHref(project, result.publicKey, identity));
    } catch (failure) {
      setError(readableError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function runSuggestion(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      hapticMedium();
    } catch (failure) {
      setError(readableError(failure));
    }
  }

  if (!release.tasks) return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Tasks unavailable' }} />
      <EmptyState icon="file-document-outline" title="Tasks unavailable" body="Conversation remains available while the task release is disabled." />
    </ThemedView>
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Tasks',
        headerLargeTitle: Platform.OS === 'ios',
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'systemMaterial',
        headerRight: () => !readOnly ? (
          <Pressable accessibilityLabel="Create task" onPress={() => setCreateOpen(true)} style={styles.headerButton}>
            <PlatformIcon color={theme.accent} name="plus" size={24} />
          </Pressable>
        ) : null,
      }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {readOnly ? <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Read-only Company exit archive</ThemedText></View> : null}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['board', 'my', 'all', 'inbox'] as const).map((value) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              key={value}
              onPress={() => { hapticLight(); setTab(value); }}
              style={[styles.tab, { backgroundColor: tab === value ? theme.backgroundSelected : theme.backgroundElement }]}>
              <ThemedText type="code">{value === 'my' ? 'My tasks' : value[0].toUpperCase() + value.slice(1)}</ThemedText>
            </Pressable>
          ))}
        </View>
        {error ? <ThemedText style={styles.error} type="small">{error}</ThemedText> : null}
        {tab === 'inbox' ? (
          readOnly ? <EmptyState icon="shield-lock-outline" title="No archived Inbox" body="Suggestions are active-work decisions and are not available in an exit archive." />
            : suggestions === undefined ? <LoadingRows />
              : suggestions.length ? suggestions.map((row) => {
                const compatible = boards?.filter((item) => item.board.groupId === row.suggestion.groupId) ?? [];
                const destination = compatible.find((item) => item.board.isDefault) ?? compatible[0];
                return <View key={row.suggestion._id} style={[styles.suggestion, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={{ color: theme.textSecondary }} type="code">{Math.round(row.suggestion.confidence * 100)}% confidence</ThemedText>
                  <ThemedText type="subtitle">{row.suggestion.proposedTitle}</ThemedText>
                  {row.suggestion.proposedDescription ? <ThemedText type="small">{row.suggestion.proposedDescription}</ThemedText> : null}
                  {row.proposedAssignee ? <ThemedText type="small">Proposed assignee: {row.proposedAssignee.user.displayName}{row.proposedAssignee.company ? ` · ${row.proposedAssignee.company.displayName}` : ''}</ThemedText> : null}
                  {row.references.map((reference) => <ThemedText key={reference._id} style={{ color: theme.textSecondary }} type="small">“{reference.quote ?? 'Reference unavailable'}”</ThemedText>)}
                  {row.possibleDuplicateTask ? <ThemedText type="smallBold">Possible duplicate: {row.possibleDuplicateTask.publicKey} · {row.possibleDuplicateTask.title}</ThemedText> : null}
                  <View style={styles.actions}>
                    <Action label={row.possibleDuplicateTask ? 'Create separately' : 'Accept'} onPress={() => destination && void runSuggestion(() => acceptSuggestion({
                      suggestionId: row.suggestion._id,
                      boardId: destination.board._id,
                      title: row.suggestion.proposedTitle,
                      description: row.suggestion.proposedDescription,
                      priority: row.suggestion.proposedPriority,
                      dueDate: row.suggestion.proposedDueDate,
                      assigneeProjectMemberId: row.suggestion.proposedAssigneeProjectMemberId,
                      duplicateOverride: Boolean(row.possibleDuplicateTask),
                      idempotencyKey: `${Date.now()}-${row.suggestion._id}`,
                      ...queryIdentity,
                    }))} />
                    {row.possibleDuplicateTask ? <Action label="Add reference" onPress={() => void runSuggestion(() => linkSuggestion({ suggestionId: row.suggestion._id, taskId: row.possibleDuplicateTask!._id, idempotencyKey: `${Date.now()}-link`, ...queryIdentity }))} /> : null}
                    {row.canDismiss ? <Action label="Dismiss" onPress={() => void runSuggestion(() => dismissSuggestion({ suggestionId: row.suggestion._id, reason: 'not_actionable', idempotencyKey: `${Date.now()}-dismiss`, ...queryIdentity }))} /> : null}
                    <Action label="Hide" onPress={() => void runSuggestion(() => hideSuggestion({ suggestionId: row.suggestion._id, ...queryIdentity }))} />
                  </View>
                </View>;
              }) : <EmptyState icon="forum-outline" title="Inbox is clear" body="Grounded suggestions from accessible conversation will appear here." />
        ) : boards === undefined || tasks === undefined ? <LoadingRows /> : !selectedBoard && tab === 'board' ? (
          <EmptyState icon="briefcase-outline" title="No board yet" body="Create the first task to initialize the default Project board." />
        ) : (
          <>
            {tab === 'board' && boards.length > 1 ? <SheetSection title="Board">
              {boards.map((item) => <SheetRow key={item.board._id} label={item.board.name} selected={item.board._id === selectedBoard?.board._id} onPress={() => setBoardId(item.board._id)} />)}
            </SheetSection> : null}
            {tab === 'board' ? grouped.map((group) => {
              const state = selectedBoard?.states.find((item) => item._id === group.stateId);
              return <TaskSection identity={identity} key={group.stateId} projectId={project} stateName={state?.name ?? 'Unknown'} tasks={group.tasks} />;
            }) : <TaskSection identity={identity} projectId={project} stateName={tab === 'my' ? 'My tasks' : 'All tasks'} tasks={tasks} />}
          </>
        )}
      </ScrollView>

      <OptionsSheet onClose={() => setCreateOpen(false)} title="Create task" visible={createOpen}>
        <SheetInput label="Title" onChangeText={setTitle} value={title} />
        <SheetInput label="Description" multiline onChangeText={setDescription} value={description} />
        <SheetSection title="Priority">
          {priorities.map((value) => <SheetRow key={value} label={value} selected={priority === value} onPress={() => setPriority(value)} />)}
        </SheetSection>
        {boards && boards.length > 1 ? <SheetSection title="Board">{boards.map((item) => <SheetRow key={item.board._id} label={item.board.name} selected={item.board._id === selectedBoard?.board._id} onPress={() => setBoardId(item.board._id)} />)}</SheetSection> : null}
        {error ? <ThemedText style={styles.error} type="small">{error}</ThemedText> : null}
        <Action disabled={busy || !title.trim()} label={busy ? 'Creating…' : 'Create task'} onPress={() => void create()} primary />
      </OptionsSheet>
    </ThemedView>
  );
}

function TaskSection({ identity, projectId, stateName, tasks }: { identity: MobileTaskIdentity | null; projectId: Id<'projects'>; stateName: string; tasks: TaskView[] }) {
  const theme = useTheme();
  const router = useRouter();
  return <View style={styles.section}><ThemedText style={{ color: theme.textSecondary }} type="code">{stateName.toUpperCase()} · {tasks.length}</ThemedText>
    {tasks.map((item) => <Pressable key={item.task._id} onPress={() => router.push(taskDetailHref(projectId, item.task.publicKey, identity))} style={[styles.task, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.taskTop}><ThemedText style={{ color: theme.textSecondary }} type="code">{item.task.publicKey}</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="code">{item.task.priority}</ThemedText></View>
      <ThemedText type="smallBold">{item.task.title}</ThemedText>
      <ThemedText style={{ color: theme.textSecondary }} type="small">{item.state?.name ?? 'Unknown'}{item.task.dueDate ? ` · due ${item.task.dueDate}` : ''}</ThemedText>
    </Pressable>)}
    {!tasks.length ? <ThemedText style={{ color: theme.textSecondary }} type="small">No tasks in this view.</ThemedText> : null}
  </View>;
}

function LoadingRows() {
  return <View><SkeletonRow /><SkeletonRow /><SkeletonRow /></View>;
}

function Action({ disabled, label, onPress, primary }: { disabled?: boolean; label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return <Pressable disabled={disabled} onPress={() => { hapticLight(); onPress(); }} style={[styles.action, { backgroundColor: primary ? theme.accent : theme.backgroundSelected, opacity: disabled ? 0.5 : 1 }]}>
    <ThemedText style={primary ? styles.actionPrimaryText : undefined} type="smallBold">{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', borderRadius: 8, minHeight: 40, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  actionPrimaryText: { color: '#1b1917' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  banner: { borderRadius: 8, padding: Spacing.three },
  content: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },
  error: { color: '#b91c1c' },
  headerButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  screen: { flex: 1 },
  section: { gap: Spacing.two },
  suggestion: { borderRadius: 10, gap: Spacing.two, padding: Spacing.three },
  tab: { borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  task: { borderRadius: 10, gap: Spacing.one, padding: Spacing.three },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between' },
});
