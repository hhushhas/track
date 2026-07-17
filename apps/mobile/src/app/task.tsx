import { useMutation, useQuery } from 'convex/react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { setActivePushContext } from '@/lib/push-presentation';

type TaskView = {
  task: Doc<'tasks'>;
  board: Doc<'taskBoards'> | null;
  state: Doc<'taskWorkflowStates'> | null;
  references: Array<Doc<'taskReferences'>>;
  labels: Array<Doc<'taskLabels'>>;
  comments: Array<Doc<'taskComments'>>;
  activities: Array<Doc<'taskActivities'>>;
  following: boolean;
  restrictedEarlierContext: boolean;
  capabilities: { canArchive: boolean; canComment: boolean; canEdit: boolean };
};

type BoardView = { board: Doc<'taskBoards'>; states: Array<Doc<'taskWorkflowStates'>> };

const priorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;

function errorMessage(failure: unknown) {
  if (!(failure instanceof Error)) return 'The task action failed.';
  if (failure.message.includes('task_conflict')) return 'This task changed elsewhere. Review the latest version and try again.';
  if (failure.message.includes('task_access_changed')) return 'This task is no longer available to this represented membership.';
  return failure.message.replaceAll('_', ' ');
}

export default function TaskScreen() {
  const theme = useTheme();
  const release = useReleaseConfig();
  const { projectId, taskKey, companyId, membershipId, archive } = useLocalSearchParams<{
    projectId: string;
    taskKey: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
  }>();
  const project = projectId as Id<'projects'>;
  useFocusEffect(useCallback(() => {
    if (projectId && taskKey) setActivePushContext({ projectId, taskKey });
    return () => setActivePushContext(null);
  }, [project, projectId, taskKey]));
  const identity = companyId && membershipId ? {
    actingCompanyId: companyId as Id<'companies'>,
    projectMemberId: membershipId as Id<'projectMembers'>,
  } : {};
  const detail = useQuery(api.tasks.getByKey, release.tasks ? {
    projectId: project,
    publicKey: taskKey,
    ...identity,
  } : 'skip') as TaskView | null | undefined;
  const boards = useQuery(api.taskBoards.list, release.tasks ? { projectId: project, ...identity } : 'skip') as BoardView[] | undefined;
  const allTasks = useQuery(api.tasks.list, release.tasks ? { projectId: project, ...identity } : 'skip') as Array<{ task: Doc<'tasks'>; state: Doc<'taskWorkflowStates'> | null }> | undefined;
  const assignees = useQuery(api.tasks.listEligibleAssignees, detail && !archive ? {
    projectId: project,
    groupId: detail.task.groupId,
    ...identity,
  } : 'skip');
  const labels = useQuery(api.taskLabels.list, release.tasks && !archive ? { projectId: project, ...identity } : 'skip');
  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const createComment = useMutation(api.taskComments.create);
  const setFollowing = useMutation(api.tasks.setFollowing);
  const setArchived = useMutation(api.tasks.setArchived);
  const setTaskLabels = useMutation(api.taskLabels.setTaskLabels);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof priorities)[number]>('none');
  const [dueDate, setDueDate] = useState('');
  const [stateId, setStateId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [labelIds, setLabelIds] = useState<Array<Id<'taskLabels'>>>([]);
  const [mentionIds, setMentionIds] = useState<Array<Id<'projectMembers'>>>([]);
  const [comment, setComment] = useState('');
  const [subtask, setSubtask] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setTitle(detail.task.title);
    setDescription(detail.task.description ?? '');
    setPriority(detail.task.priority);
    setDueDate(detail.task.dueDate ?? '');
    setStateId(detail.task.workflowStateId);
    setAssigneeId(detail.task.assigneeProjectMemberId ?? '');
    setLabelIds(detail.labels.map((label) => label._id));
  }, [detail]);

  if (!release.tasks) return <ThemedView style={styles.screen}><EmptyState icon="file-document-outline" title="Tasks unavailable" body="Conversation remains available while the task release is disabled." /></ThemedView>;
  if (detail === undefined) return <ThemedView style={styles.screen}><Stack.Screen options={{ title: taskKey || 'Task' }} /><View style={styles.center}><ThemedText>Loading task…</ThemedText></View></ThemedView>;
  if (!detail) return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Task unavailable' }} /><EmptyState icon="shield-lock-outline" title="Task unavailable" body="The task does not exist or this represented membership cannot access its scope." /></ThemedView>;

  const board = boards?.find((item) => item.board._id === detail.task.boardId);
  const subtasks = allTasks?.filter((item) => item.task.parentTaskId === detail.task._id) ?? [];
  const readOnly = archive === '1' || !detail.capabilities.canEdit;

  async function run(action: () => Promise<unknown>, clear?: () => void) {
    setBusy(true);
    setError('');
    try {
      await action();
      clear?.();
      hapticMedium();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: detail.task.publicKey }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {archive === '1' ? <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Read-only Company exit archive</ThemedText></View> : null}
        <View style={styles.heading}>
          <ThemedText style={{ color: theme.textSecondary }} type="code">{detail.task.publicKey} · {detail.board?.name ?? 'Archived board'}</ThemedText>
          <ThemedText type="title">{detail.task.title}</ThemedText>
        </View>
        <SheetInput label="Title" onChangeText={setTitle} value={title} />
        <SheetInput label="Description" multiline onChangeText={setDescription} value={description} />
        <SheetInput label="Due date (YYYY-MM-DD)" onChangeText={setDueDate} value={dueDate} />
        <View style={styles.actions}>
          <Action disabled={readOnly} label={board?.states.find((state) => state._id === stateId)?.name ?? 'Status'} onPress={() => setStatusOpen(true)} />
          <Action disabled={readOnly} label={priorities.includes(priority) ? priority : 'priority'} onPress={() => setStatusOpen(true)} />
          <Action disabled={readOnly} label={assignees?.find((item) => item.member._id === assigneeId)?.user.displayName ?? 'Unassigned'} onPress={() => setAssigneeOpen(true)} />
        </View>
        <Section title="Labels">
          <View style={styles.actions}>{labels?.map((label) => <Action key={label._id} label={`${labelIds.includes(label._id) ? '✓ ' : ''}${label.name}`} onPress={() => setLabelIds((current) => current.includes(label._id) ? current.filter((id) => id !== label._id) : [...current, label._id])} />)}</View>
          {!readOnly ? <Action label="Apply labels" onPress={() => void run(() => setTaskLabels({ taskId: detail.task._id, labelIds, expectedRevision: detail.task.revision, ...identity }))} /> : null}
        </Section>
        {error ? <ThemedText style={styles.error} type="small">{error}</ThemedText> : null}
        {!readOnly ? <Action disabled={busy || !title.trim()} label={busy ? 'Saving…' : 'Save changes'} onPress={() => void run(() => updateTask({
          taskId: detail.task._id,
          expectedRevision: detail.task.revision,
          title,
          description: description.trim() || null,
          workflowStateId: stateId as Id<'taskWorkflowStates'>,
          assigneeProjectMemberId: assigneeId ? assigneeId as Id<'projectMembers'> : null,
          priority,
          dueDate: dueDate || null,
          confirmOpenSubtasks: true,
          ...identity,
        }))} primary /> : <ThemedText style={{ color: theme.textSecondary }} type="small">Read-only task history</ThemedText>}
        <View style={styles.actions}>
          <Action label={detail.following ? 'Unfollow' : 'Follow'} onPress={() => void run(() => setFollowing({ taskId: detail.task._id, enabled: !detail.following, ...identity }))} />
          {detail.capabilities.canArchive && archive !== '1' ? <Action label={detail.task.archivedAt ? 'Restore' : 'Archive'} onPress={() => void run(() => setArchived({ taskId: detail.task._id, archived: !detail.task.archivedAt, ...identity }))} /> : null}
        </View>

        <Section title="Subtasks">
          {subtasks.map((item) => <View key={item.task._id} style={styles.row}><ThemedText type="smallBold">{item.task.title}</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="code">{item.state?.name ?? 'Unknown'}</ThemedText></View>)}
          {!readOnly && !detail.task.parentTaskId ? <><SheetInput label="New subtask" onChangeText={setSubtask} value={subtask} /><Action disabled={!subtask.trim()} label="Add subtask" onPress={() => void run(() => createTask({ projectId: project, boardId: detail.task.boardId, parentTaskId: detail.task._id, title: subtask, priority: 'none', idempotencyKey: `${Date.now()}-subtask`, ...identity }), () => setSubtask(''))} /></> : null}
        </Section>

        <Section title="Evidence">
          {detail.references.length ? detail.references.map((reference) => <View key={reference._id} style={[styles.evidence, { borderLeftColor: theme.accent }]}><ThemedText type="small">{reference.quote ?? 'Source unavailable'}</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="code">{reference.type.replaceAll('_', ' ')}</ThemedText></View>) : <ThemedText style={{ color: theme.textSecondary }} type="small">No linked evidence.</ThemedText>}
          {detail.restrictedEarlierContext ? <ThemedText style={{ color: theme.textSecondary }} type="smallBold">Earlier context is restricted.</ThemedText> : null}
        </Section>

        <Section title="Comments">
          {detail.comments.filter((item) => !item.archivedAt).map((item) => <View key={item._id} style={styles.row}><ThemedText type="small">{item.body}</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="code">{new Date(item.createdAt).toLocaleString()}</ThemedText></View>)}
          {detail.capabilities.canComment && archive !== '1' ? <><SheetInput label="Add comment" multiline onChangeText={setComment} value={comment} /><View style={styles.actions}>{assignees?.map((item) => <Action key={item.member._id} label={`${mentionIds.includes(item.member._id) ? '✓ ' : '@'}${item.user.displayName}`} onPress={() => setMentionIds((current) => current.includes(item.member._id) ? current.filter((id) => id !== item.member._id) : [...current, item.member._id])} />)}</View><Action disabled={!comment.trim()} label="Comment" onPress={() => void run(() => createComment({ taskId: detail.task._id, body: comment, mentionedProjectMemberIds: mentionIds, idempotencyKey: `${Date.now()}-comment`, ...identity }), () => { setComment(''); setMentionIds([]); })} /></> : null}
        </Section>

        <Section title="Activity">
          {detail.activities.map((item) => <View key={item._id} style={styles.activity}><ThemedText type="small">{item.action.replaceAll('_', ' ')}</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="code">{new Date(item.createdAt).toLocaleString()}</ThemedText></View>)}
        </Section>
      </ScrollView>

      <OptionsSheet onClose={() => setStatusOpen(false)} title="Status and priority" visible={statusOpen}>
        <SheetSection title="Status">{board?.states.map((state) => <SheetRow key={state._id} label={`${state.name} · ${state.category}`} selected={stateId === state._id} onPress={() => setStateId(state._id)} />)}</SheetSection>
        <SheetSection title="Priority">{priorities.map((value) => <SheetRow key={value} label={value} selected={priority === value} onPress={() => setPriority(value)} />)}</SheetSection>
      </OptionsSheet>
      <OptionsSheet onClose={() => setAssigneeOpen(false)} title="Assignee" visible={assigneeOpen}>
        <SheetSection><SheetRow label="Unassigned" selected={!assigneeId} onPress={() => setAssigneeId('')} />{assignees?.map((item) => <SheetRow key={item.member._id} label={`${item.user.displayName}${item.company ? ` · ${item.company.displayName}` : ''}`} selected={assigneeId === item.member._id} onPress={() => setAssigneeId(item.member._id)} />)}</SheetSection>
      </OptionsSheet>
    </ThemedView>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <View style={styles.section}><ThemedText type="subtitle">{title}</ThemedText>{children}</View>;
}

function Action({ disabled, label, onPress, primary }: { disabled?: boolean; label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return <Pressable disabled={disabled} onPress={() => { hapticLight(); onPress(); }} style={[styles.action, { backgroundColor: primary ? theme.accent : theme.backgroundSelected, opacity: disabled ? 0.5 : 1 }]}><ThemedText style={primary ? styles.primaryText : undefined} type="smallBold">{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', borderRadius: 8, minHeight: 40, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  activity: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 2, paddingVertical: Spacing.two },
  banner: { borderRadius: 8, padding: Spacing.three },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  error: { color: '#b91c1c' },
  evidence: { borderLeftWidth: 3, gap: Spacing.one, paddingLeft: Spacing.three },
  heading: { gap: Spacing.one },
  primaryText: { color: '#1b1917' },
  row: { gap: Spacing.one, paddingVertical: Spacing.two },
  screen: { flex: 1 },
  section: { gap: Spacing.two },
});
