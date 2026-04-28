import { parseMentions } from '@track/shared';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

const notificationModes = ['inherit', 'all', 'mentions', 'none'] as const;
const draftClassifications = [
  'billable_scope',
  'non_billable_scope',
  'official_record',
  'informational',
  'ignored',
] as const;
const draftStatuses = ['open', 'in_progress', 'blocked', 'done'] as const;

export default function ThreadScreen() {
  const theme = useTheme();
  const session = authClient.useSession();
  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser);
  const acceptInvites = useMutation(api.invitations.acceptPendingForCurrentUser);
  const ensureStarterProject = useMutation(api.projects.ensureStarter);
  const createProject = useMutation(api.projects.create);
  const createGroup = useMutation(api.groups.create);
  const createInvitation = useMutation(api.invitations.create);
  const sendMessageMutation = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachFileMutation = useMutation(api.messages.attachFile);
  const runReviewAction = useAction(api.ai.runReviewNow);
  const classifyDraftMutation = useMutation(api.records.classifyDraft);
  const askTrackAction = useAction(api.assistant.ask);
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode);
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode);

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null);
  const [composer, setComposer] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const trackUser = useQuery(api.auth.getCurrentUser);
  const projects = useQuery(api.projects.list, trackUserId ? { userId: trackUserId } : 'skip');
  const groups = useQuery(
    api.groups.listVisible,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId, limit: 80 } : 'skip',
  );
  const drafts = useQuery(
    api.records.listDrafts,
    trackUserId && activeProjectId && activeGroupId
      ? { userId: trackUserId, projectId: activeProjectId, groupId: activeGroupId }
      : 'skip',
  );
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );
  const latestReview = useQuery(
    api.ai.latestForGroup,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId } : 'skip',
  );
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId, limit: 20 } : 'skip',
  );
  const notificationSettings = useQuery(
    api.notifications.getSettings,
    trackUserId ? { userId: trackUserId } : 'skip',
  );

  const projectItems = useMemo(
    () =>
      (projects ?? []) as Array<{
        project: Doc<'projects'>;
        membership: Doc<'projectMembers'>;
      }>,
    [projects],
  );
  const visibleGroups = useMemo(() => (groups ?? []) as Array<Doc<'groups'>>, [groups]);
  const threadMessages = useMemo(
    () =>
      [
        ...((messages ?? []) as Array<{
          message: Doc<'messages'>;
          author: Doc<'users'> | null;
          attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>;
        }>),
      ].reverse(),
    [messages],
  );
  const pendingDrafts = useMemo(
    () => ((drafts ?? []) as Array<Doc<'draftRecords'>>).filter((draft) => draft.status === 'pending'),
    [drafts],
  );
  const projectRecords = useMemo(() => (records ?? []) as Array<Doc<'records'>>, [records]);
  const groupAssistantStreams = useMemo(
    () => (assistantStreams ?? []) as Array<Doc<'assistantStreams'>>,
    [assistantStreams],
  );
  const threadItems = useMemo(
    () =>
      [
        ...threadMessages.map((item) => ({
          at: item.message.createdAt,
          item,
          kind: 'message' as const,
          key: item.message._id,
        })),
        ...groupAssistantStreams.map((stream) => ({
          at: stream.createdAt,
          stream,
          kind: 'assistant' as const,
          key: stream._id,
        })),
        ...pendingDrafts.map((draft) => ({
          at: draft.createdAt,
          draft,
          kind: 'draft' as const,
          key: draft._id,
        })),
      ].sort((a, b) => a.at - b.at),
    [groupAssistantStreams, pendingDrafts, threadMessages],
  );
  const groupNotificationSettings = useMemo(
    () => (notificationSettings?.groups ?? []) as Array<Doc<'groupNotificationSettings'>>,
    [notificationSettings?.groups],
  );

  const activeProject = projectItems.find((item) => item.project._id === activeProjectId);
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId);
  const groupNotificationMode =
    groupNotificationSettings.find((item) => item.groupId === activeGroupId)?.mode ?? 'inherit';
  const globalNotificationMode = notificationSettings?.global?.globalMode ?? 'mentions';

  useEffect(() => {
    if (!session.data || trackUserId) return;
    void ensureCurrentUser()
      .then(async (userId) => {
        setTrackUserId(userId);
        await acceptInvites({ userId });
      })
      .catch(setActionError);
  }, [acceptInvites, ensureCurrentUser, session.data, trackUserId]);

  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) setTrackUserId(trackUser._id);
  }, [trackUser?._id, trackUserId]);

  useEffect(() => {
    if (!trackUserId || projects === undefined || projectItems.length > 0) return;
    void ensureStarterProject({ userId: trackUserId })
      .then((projectId) => setActiveProjectId(projectId))
      .catch(setActionError);
  }, [ensureStarterProject, projectItems.length, projects, trackUserId]);

  useEffect(() => {
    if (!projectItems.length || activeProjectId) return;
    setActiveProjectId(projectItems[0]?.project._id ?? null);
  }, [activeProjectId, projectItems]);

  useEffect(() => {
    if (!visibleGroups.length) {
      setActiveGroupId(null);
      return;
    }
    if (!activeGroupId || !visibleGroups.some((group) => group._id === activeGroupId)) {
      setActiveGroupId(visibleGroups[0]?._id ?? null);
    }
  }, [activeGroupId, visibleGroups]);

  function setActionError(error: unknown) {
    setUiError(error instanceof Error ? error.message : 'Something went wrong');
  }

  async function withBusy(label: string, action: () => Promise<unknown>) {
    setBusyAction(label);
    setUiError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusyAction(null);
    }
  }

  async function sendMessage() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return;
    const body = composer.trim();
    if (!body) return;
    setComposer('');
    await withBusy('send-message', async () => {
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body,
        mentions: [],
      });
      if (parseMentions(body).includes('track')) {
        await askTrackAction({
          projectId: activeProjectId,
          groupId: activeGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: body,
        });
      }
    });
  }

  async function attachDocument() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return;
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    await withBusy('attach-file', async () => {
      const uploadUrl = await generateUploadUrl({ groupId: activeGroupId, userId: trackUserId });
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.mimeType ?? 'application/octet-stream' },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error('upload_failed');
      const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: composer.trim() || `Attached ${file.name}`,
        mentions: [],
      });
      await attachFileMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        messageId,
        userId: trackUserId,
        storageId,
        filename: file.name,
        contentType: file.mimeType ?? 'application/octet-stream',
        size: file.size ?? blob.size,
      });
      setComposer('');
    });
  }

  async function runReview() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return;
    await withBusy('run-review', async () => {
      await runReviewAction({
        projectId: activeProjectId,
        groupId: activeGroupId,
        reviewerId: trackUserId,
      });
    });
  }

  async function createNewProject() {
    if (!trackUserId || !newProjectName.trim()) return;
    await withBusy('create-project', async () => {
      const projectId = await createProject({ userId: trackUserId, name: newProjectName.trim() });
      setActiveProjectId(projectId);
      setActiveGroupId(null);
      setNewProjectName('');
    });
  }

  async function createNewGroup() {
    if (!trackUserId || !activeProjectId || !newGroupName.trim()) return;
    await withBusy('create-group', async () => {
      const groupId = await createGroup({
        userId: trackUserId,
        projectId: activeProjectId,
        name: newGroupName.trim(),
      });
      setActiveGroupId(groupId);
      setNewGroupName('');
    });
  }

  async function inviteStaff() {
    if (!trackUserId || !activeProjectId || !inviteEmail.trim()) return;
    await withBusy('invite', async () => {
      await createInvitation({
        projectId: activeProjectId,
        groupId: activeGroupId ?? undefined,
        invitedBy: trackUserId,
        email: inviteEmail.trim(),
        role: 'staff',
        canReviewAiRecords: false,
      });
      setInviteEmail('');
    });
  }

  async function setNotificationMode(mode: (typeof notificationModes)[number]) {
    if (!trackUserId) return;
    await withBusy('notifications', async () => {
      if (activeGroupId) {
        await setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode });
      } else if (mode !== 'inherit') {
        await setGlobalNotificationMode({ userId: trackUserId, mode });
      }
    });
  }

  async function classifyDraft(
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return;
    await withBusy(`classify-${draftRecordId}`, async () => {
      await classifyDraftMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        draftRecordId,
        reviewerId: trackUserId,
        classification,
        status: updates.status,
        title: updates.title,
        description: updates.description,
      });
    });
  }

  if (session.isPending) {
    return <CenteredState label="Checking your session" />;
  }

  if (!session.data) {
    return (
      <CenteredState
        actionLabel="Continue with Google"
        label="Sign in to Track"
        onAction={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/' })}
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
          <View style={styles.headerTitle}>
            <ThemedText type="code" themeColor="textSecondary">
              {activeProject?.project.clientLabel ?? activeProject?.membership.role ?? 'Track'}
            </ThemedText>
            <ThemedText type="subtitle">{activeGroup?.name ?? 'Select a Group'}</ThemedText>
          </View>
          <Pressable
            disabled={!activeGroupId || busyAction === 'run-review'}
            onPress={runReview}
            style={[styles.reviewButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.reviewText}>
              Review
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.six }]}
          showsVerticalScrollIndicator={false}>
          {uiError ? (
            <ThemedView style={[styles.error, { borderColor: theme.hairline }]}>
              <ThemedText type="small">{uiError}</ThemedText>
            </ThemedView>
          ) : null}

          <InlineCreator
            buttonLabel="Project"
            onChange={setNewProjectName}
            onSubmit={createNewProject}
            placeholder="New project name"
            value={newProjectName}
          />

          <ScrollView horizontal contentContainerStyle={styles.groupRail} showsHorizontalScrollIndicator={false}>
            {projectItems.map((item) => (
              <Pressable key={item.project._id} onPress={() => setActiveProjectId(item.project._id)}>
                <Pill selected={item.project._id === activeProjectId} title={item.project.name} meta={item.membership.role} />
              </Pressable>
            ))}
          </ScrollView>

          <InlineCreator
            buttonLabel="Group"
            onChange={setNewGroupName}
            onSubmit={createNewGroup}
            placeholder="New group name"
            value={newGroupName}
          />

          <ScrollView horizontal contentContainerStyle={styles.groupRail} showsHorizontalScrollIndicator={false}>
            {visibleGroups.map((group) => (
              <Pressable key={group._id} onPress={() => setActiveGroupId(group._id)}>
                <Pill
                  selected={group._id === activeGroupId}
                  title={group.name}
                  meta={`${group.kind} / ${group.aiReviewSettings?.frequencyMinutes ?? 30}m`}
                />
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.metrics}>
            <Metric label="Drafts" value={pendingDrafts.length} />
            <Metric label="Records" value={projectRecords.length} />
            <Metric
              label="Billable"
              value={projectRecords.filter((record) => record.classification === 'billable_scope').length}
            />
            <Metric label="Notify" value={groupNotificationMode} />
          </View>

          <ThemedView type="backgroundElement" style={[styles.settings, { borderColor: theme.hairline }]}>
            <ThemedText type="code" themeColor="textSecondary">
              Global {globalNotificationMode} / Group {groupNotificationMode}
            </ThemedText>
            <View style={styles.modeGrid}>
              {notificationModes.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => void setNotificationMode(mode)}
                  style={[
                    styles.modeButton,
                    {
                      borderColor: mode === groupNotificationMode ? theme.accent : theme.hairline,
                      backgroundColor: mode === groupNotificationMode ? theme.accentSoft : theme.background,
                    },
                  ]}>
                  <ThemedText type="code">{mode}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <InlineCreator
            buttonLabel="Invite"
            onChange={setInviteEmail}
            onSubmit={inviteStaff}
            placeholder="Invite email to current project/group"
            value={inviteEmail}
          />

          <ThemedView type="backgroundElement" style={[styles.reviewSummary, { borderColor: theme.hairline }]}>
            <ThemedText type="smallBold">AI Review</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {latestReview?.summary ?? 'Run AI Review to propose Draft Records from this Group.'}
            </ThemedText>
          </ThemedView>

          <View style={styles.messages}>
            {threadItems.map((threadItem) => {
              if (threadItem.kind === 'message') {
                return <MessageCard key={threadItem.key} item={threadItem.item} />;
              }
              if (threadItem.kind === 'assistant') {
                return (
                  <ThemedView
                    key={threadItem.key}
                    type="backgroundSelected"
                    style={[styles.message, { borderColor: theme.accent }]}>
                    <ThemedText type="smallBold">Track Assistant</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {threadItem.stream.answer || threadItem.stream.status}
                    </ThemedText>
                  </ThemedView>
                );
              }
              return (
                <DraftCard
                  busy={busyAction === `classify-${threadItem.draft._id}`}
                  draft={threadItem.draft}
                  key={threadItem.key}
                  onClassify={classifyDraft}
                />
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: theme.hairline }]}>
          <Pressable onPress={attachDocument} style={[styles.attachButton, { borderColor: theme.hairline }]}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
          <TextInput
            onChangeText={setComposer}
            onSubmitEditing={sendMessage}
            placeholder={`Message ${activeGroup?.name ?? 'Group'} or ask @track...`}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { borderColor: theme.hairline, color: theme.text, backgroundColor: theme.background },
            ]}
            value={composer}
          />
          <Pressable onPress={sendMessage} style={[styles.sendButton, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Send
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function CenteredState({
  actionLabel,
  label,
  onAction,
}: {
  actionLabel?: string;
  label: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.centered}>
      <ThemedText type="code" themeColor="textSecondary">
        Track Access
      </ThemedText>
      <ThemedText type="subtitle">{label}</ThemedText>
      {actionLabel ? (
        <Pressable onPress={onAction} style={[styles.signInButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={styles.reviewText}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

function InlineCreator({
  buttonLabel,
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  buttonLabel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.inlineCreator}>
      <TextInput
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.inlineInput, { borderColor: theme.hairline, color: theme.text }]}
        value={value}
      />
      <Pressable onPress={onSubmit} style={[styles.inlineButton, { backgroundColor: theme.text }]}>
        <ThemedText type="code" style={{ color: theme.background }}>
          {buttonLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Pill({ meta, selected, title }: { meta: string; selected: boolean; title: string }) {
  const theme = useTheme();
  return (
    <ThemedView
      type={selected ? 'backgroundSelected' : 'backgroundElement'}
      style={[styles.groupPill, { borderColor: selected ? theme.accent : theme.hairline }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {meta}
      </ThemedText>
    </ThemedView>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.metric, { borderColor: theme.hairline }]}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function MessageCard({
  item,
}: {
  item: {
    message: Doc<'messages'>;
    author: Doc<'users'> | null;
    attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>;
  };
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.message, { borderColor: theme.hairline }]}>
      <View style={styles.messageMeta}>
        <ThemedText type="smallBold">{item.author?.displayName ?? 'Unknown Member'}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {new Date(item.message.createdAt).toLocaleTimeString()}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {item.message.body}
      </ThemedText>
      {item.attachments.map(({ attachment }) => (
        <ThemedText key={attachment._id} type="code" themeColor="textSecondary">
          Attachment: {attachment.filename}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

function DraftCard({
  busy,
  draft,
  onClassify,
}: {
  busy: boolean;
  draft: Doc<'draftRecords'>;
  onClassify: (
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) => Promise<void>;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [status, setStatus] = useState<(typeof draftStatuses)[number]>(
    draftStatuses.includes(draft.proposedStatus as (typeof draftStatuses)[number])
      ? (draft.proposedStatus as (typeof draftStatuses)[number])
      : 'open',
  );
  const updates = { title, description, status };
  return (
    <ThemedView type="backgroundSelected" style={[styles.draft, { borderColor: theme.accent }]}>
      <ThemedText type="code" themeColor="textSecondary">
        Draft Record / {draft.type}
      </ThemedText>
      <TextInput
        editable={!busy}
        onChangeText={setTitle}
        style={[styles.draftInput, { borderColor: theme.hairline, color: theme.text }]}
        value={title}
      />
      <TextInput
        editable={!busy}
        multiline
        onChangeText={setDescription}
        style={[styles.draftInput, styles.draftTextArea, { borderColor: theme.hairline, color: theme.text }]}
        value={description}
      />
      <View style={styles.statusRow}>
        {draftStatuses.map((item) => (
          <Pressable
            disabled={busy}
            key={item}
            onPress={() => setStatus(item)}
            style={[
              styles.statusButton,
              {
                borderColor: item === status ? theme.accent : theme.hairline,
                backgroundColor: item === status ? theme.accentSoft : theme.background,
              },
            ]}>
            <ThemedText type="code">{item}</ThemedText>
          </Pressable>
        ))}
      </View>
      <View style={styles.draftActions}>
        {draftClassifications.map((classification) => (
          <Pressable
            disabled={busy}
            key={classification}
            onPress={() => void onClassify(draft._id, classification, updates)}
            style={[styles.draftButton, { borderColor: theme.hairline }]}>
            <ThemedText type="code">{classification}</ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  signInButton: {
    borderRadius: 6,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerTitle: { flex: 1 },
  reviewButton: {
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reviewText: { color: '#1b1917' },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  error: {
    borderWidth: 1,
    borderRadius: 6,
    padding: Spacing.three,
  },
  inlineCreator: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inlineInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
  },
  inlineButton: {
    minWidth: 78,
    minHeight: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  groupRail: { gap: Spacing.two },
  groupPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 136,
    gap: Spacing.one,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metric: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    minWidth: 92,
  },
  settings: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  modeButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reviewSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  messages: { gap: Spacing.three },
  message: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  draft: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  draftInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 13,
  },
  draftTextArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statusButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  draftActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  draftButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  composer: {
    borderTopWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
  },
  sendButton: {
    minHeight: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
