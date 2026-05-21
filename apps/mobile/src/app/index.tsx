import { parseMentions } from '@track/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAction, useMutation, useQuery } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as DocumentPicker from 'expo-document-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import googleMarkImage from '@/assets/images/google-g.png';
import trackMarkImage from '@/assets/images/track-mark.png';
import trackMarkReversedImage from '@/assets/images/track-mark-reversed.png';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient, setTwoFactorRedirectHandler } from '@/lib/auth-client';
import { useDevAuthBypass } from '@/lib/dev-auth-bypass';

type MobileProject = {
  project: Doc<'projects'>;
  membership: Doc<'projectMembers'>;
  groupCount: number;
  unreadCount: number;
};

type MobileGroup = {
  group: Doc<'groups'>;
  membership: Doc<'groupMembers'>;
  lastMessage: Doc<'messages'> | null;
  unreadCount: number;
};

type DetailedMessage = {
  message: Doc<'messages'>;
  author: Doc<'users'> | null;
  authorRole?: Doc<'projectMembers'>['role'] | null;
  attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>;
  replyTo?: {
    messageId: Id<'messages'>;
    authorName: string;
    body: string;
    createdAt: number;
  } | null;
};

type ProjectMemberRow = {
  membership: Doc<'projectMembers'>;
  user: Doc<'users'> | null;
};

type ThreadItem =
  | { kind: 'message'; key: string; at: number; item: DetailedMessage }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'> };

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const reportReasons = ['inaccurate', 'unsafe', 'spam', 'harassment', 'privacy', 'other'] as const;

export default function MobileTrackApp() {
  const theme = useTheme();
  const session = authClient.useSession();
  const devAuthBypass = useDevAuthBypass();
  const listRef = useRef<FlatList<ThreadItem>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingState = useAudioRecorderState(recorder, 250);

  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser);
  const syncDevUser = useMutation(api.auth.syncDevUser);
  const acceptInvites = useMutation(api.invitations.acceptPendingForCurrentUser);
  const updateProfile = useMutation(api.auth.updateProfile);
  const ensureStarterProject = useMutation(api.projects.ensureStarter);
  const sendMessageMutation = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachFileMutation = useMutation(api.messages.attachFile);
  const askTrackAction = useAction(api.assistant.ask);
  const registerNativeToken = useMutation(api.notifications.registerNativeToken);
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode);
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode);
  const markGroupRead = useMutation(api.mobile.markGroupRead);
  const setLastActiveContext = useMutation(api.mobile.setLastActiveContext);
  const createReport = useMutation(api.reports.create);
  const requestAccountDeletion = useMutation(api.auth.requestAccountDeletion);

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null);
  const [route, setRoute] = useState<'projects' | 'groups' | 'conversation'>('projects');
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null);
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<DetailedMessage | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'group-switcher' | 'tools' | 'profile' | 'two-factor' | null>(null);
  const [reportTarget, setReportTarget] = useState<ThreadItem | null>(null);
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>('inaccurate');
  const [reportNote, setReportNote] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    displayName: '',
    profileDesignation: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'backup_code'>('totp');

  const hasSessionAccess = Boolean(session.data || devAuthBypass.enabled);
  const trackUser = useQuery(api.auth.getCurrentUser);
  const profileStatus = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const projects = useQuery(api.mobile.listProjects, trackUserId ? { userId: trackUserId } : 'skip');
  const groups = useQuery(
    api.mobile.listGroups,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId, limit: 120 } : 'skip',
  );
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId, limit: 40 } : 'skip',
  );
  const notificationSettings = useQuery(
    api.notifications.getSettings,
    trackUserId ? { userId: trackUserId } : 'skip',
  );
  const projectMembers = useQuery(
    api.projects.listMembers,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );

  const projectItems = useMemo(() => (projects ?? []) as MobileProject[], [projects]);
  const groupItems = useMemo(() => (groups ?? []) as MobileGroup[], [groups]);
  const projectMemberItems = useMemo(() => (projectMembers ?? []) as ProjectMemberRow[], [projectMembers]);
  const activeProject = projectItems.find((item) => item.project._id === activeProjectId) ?? null;
  const activeGroup = groupItems.find((item) => item.group._id === activeGroupId) ?? null;
  const globalNotificationMode = notificationSettings?.global?.globalMode ?? 'mentions';
  const groupNotificationMode =
    notificationSettings?.groups?.find((item) => item.groupId === activeGroupId)?.mode ?? 'inherit';

  const threadItems = useMemo(() => {
    const detailedMessages = [...(((messages ?? []) as DetailedMessage[]).reverse())];
    return [
      ...detailedMessages.map((item) => ({
        kind: 'message' as const,
        key: item.message._id,
        at: item.message.createdAt,
        item,
      })),
      ...(((assistantStreams ?? []) as Doc<'assistantStreams'>[]).map((stream) => ({
        kind: 'assistant' as const,
        key: stream._id,
        at: stream.createdAt,
        stream,
      }))),
    ].sort((a, b) => a.at - b.at);
  }, [assistantStreams, messages]);

  useEffect(() => {
    setTwoFactorRedirectHandler(() => {
      setSheet('two-factor');
    });
    return () => setTwoFactorRedirectHandler(null);
  }, []);

  useEffect(() => {
    if (!hasSessionAccess || trackUserId) return;
    const syncUser = devAuthBypass.enabled && !session.data ? syncDevUser : ensureCurrentUser;
    void syncUser()
      .then(async (userId) => {
        if (!userId) return;
        setTrackUserId(userId);
        await acceptInvites({ userId });
      })
      .catch(setActionError);
  }, [acceptInvites, devAuthBypass.enabled, ensureCurrentUser, hasSessionAccess, session.data, syncDevUser, trackUserId]);

  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) setTrackUserId(trackUser._id);
  }, [trackUser?._id, trackUserId]);

  useEffect(() => {
    if (!trackUserId || projects === undefined || projectItems.length > 0) return;
    void ensureStarterProject({ userId: trackUserId })
      .then((projectId) => {
        setActiveProjectId(projectId);
        setRoute('groups');
      })
      .catch(setActionError);
  }, [ensureStarterProject, projectItems.length, projects, trackUserId]);

  useEffect(() => {
    if (!profileStatus?.user) return;
    setProfileDraft({
      displayName: profileStatus.user.displayName ?? '',
      profileDesignation: profileStatus.user.profileDesignation ?? '',
      timezone: profileStatus.user.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    });
    if (!profileStatus.complete) setSheet('profile');
  }, [profileStatus?.complete, profileStatus?.user]);

  useEffect(() => {
    if (!trackUserId || !Device.isDevice || Platform.OS === 'web') return;
    void registerForPushNotifications(trackUserId).catch(() => undefined);
  }, [trackUserId]);

  useEffect(() => {
    if (!trackUserId || !activeProjectId) return;
    void setLastActiveContext({
      userId: trackUserId,
      projectId: activeProjectId,
      groupId: activeGroupId ?? undefined,
      deviceId: Constants.sessionId ?? undefined,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    }).catch(() => undefined);
  }, [activeGroupId, activeProjectId, setLastActiveContext, trackUserId]);

  useEffect(() => {
    if (!trackUserId || !activeGroupId || route !== 'conversation' || threadItems.length === 0) return;
    const lastMessage = [...threadItems].reverse().find((item) => item.kind === 'message');
    void markGroupRead({
      userId: trackUserId,
      groupId: activeGroupId,
      lastReadMessageId: lastMessage?.kind === 'message' ? lastMessage.item.message._id : undefined,
    }).catch(() => undefined);
  }, [activeGroupId, markGroupRead, route, threadItems, trackUserId]);

  async function registerForPushNotifications(userId: Id<'users'>) {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    await registerNativeToken({ userId, platform: Platform.OS, token: token.data });
  }

  function setActionError(error: unknown) {
    setUiError(error instanceof Error ? error.message : 'Something went wrong');
  }

  async function signInWithProvider(provider: 'apple' | 'google') {
    await withBusy(`sign-in-${provider}`, async () => {
      const result = await authClient.signIn.social({ provider, callbackURL: '/' });
      const error = (result as { error?: { code?: string; message?: string } | null }).error;
      if (!error) return;
      if (provider === 'apple') {
        throw new Error('Apple sign-in is not configured yet. Add Apple credentials in Convex production and redeploy.');
      }
      throw new Error(error.message ?? error.code ?? 'Sign-in failed');
    });
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
    const replyToMessageId = replyTo?.message._id;
    setComposer('');
    setReplyTo(null);
    await withBusy('send-message', async () => {
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body,
        mentions: resolveMentionIds(body, projectMemberItems),
        replyToMessageId,
        notificationPreview: body,
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

  async function uploadAttachment(input: {
    uri: string;
    filename: string;
    contentType: string;
    body: string;
    kind?: 'file' | 'voice_note';
    durationMs?: number;
  }) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return;
    await withBusy(input.kind === 'voice_note' ? 'voice-note' : 'attach-file', async () => {
      const uploadUrl = await generateUploadUrl({ groupId: activeGroupId, userId: trackUserId });
      const response = await fetch(input.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': input.contentType },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error('upload_failed');
      const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: input.body,
        mentions: resolveMentionIds(input.body, projectMemberItems),
        replyToMessageId: replyTo?.message._id,
        notificationPreview: input.body,
      });
      await attachFileMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        messageId,
        userId: trackUserId,
        storageId,
        filename: input.filename,
        contentType: input.contentType,
        size: blob.size,
        kind: input.kind,
        durationMs: input.durationMs,
      });
      setComposer('');
      setReplyTo(null);
    });
  }

  async function attachDocument() {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    await uploadAttachment({
      uri: file.uri,
      filename: file.name,
      contentType: file.mimeType ?? 'application/octet-stream',
      body: composer.trim() || `Attached ${file.name}`,
      kind: 'file',
    });
  }

  async function toggleRecording() {
    if (recordingState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      await uploadAttachment({
        uri,
        filename: `voice-note-${Date.now()}.m4a`,
        contentType: 'audio/mp4',
        body: composer.trim() || 'Sent a voice note.',
        kind: 'voice_note',
        durationMs: Math.max(0, Math.round(recordingState.durationMillis)),
      });
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setUiError('Microphone permission is needed for voice notes.');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function submitProfile() {
    if (!trackUserId) return;
    await withBusy('profile', async () => {
      await updateProfile({
        userId: trackUserId,
        displayName: profileDraft.displayName,
        profileDesignation: profileDraft.profileDesignation,
        timezone: profileDraft.timezone,
        profileBannerStyle: 'silk',
      });
      setSheet(null);
    });
  }

  async function submitTwoFactor() {
    await withBusy('two-factor', async () => {
      if (twoFactorMethod === 'backup_code') {
        await authClient.twoFactor.verifyBackupCode({ code: twoFactorCode, disableSession: false });
      } else {
        await authClient.twoFactor.verifyTotp({ code: twoFactorCode });
      }
      setTwoFactorCode('');
      setSheet(null);
    });
  }

  async function submitReport() {
    if (!trackUserId || !activeProjectId || !reportTarget) return;
    await withBusy('report', async () => {
      await createReport({
        projectId: activeProjectId,
        reporterId: trackUserId,
        groupId: activeGroupId ?? undefined,
        targetType: reportTarget.kind === 'assistant' ? 'assistant_answer' : 'message',
        targetMessageId: reportTarget.kind === 'message' ? reportTarget.item.message._id : undefined,
        targetAssistantStreamId: reportTarget.kind === 'assistant' ? reportTarget.stream._id : undefined,
        reason: reportReason,
        note: reportNote,
      });
      setReportTarget(null);
      setReportNote('');
      setReportReason('inaccurate');
    });
  }

  function confirmDeletion() {
    if (!trackUserId) return;
    Alert.alert('Delete account', 'Track will remove your profile and disable notifications. Shared project evidence is retained for project integrity.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void withBusy('delete-account', async () => {
          await requestAccountDeletion({ userId: trackUserId });
          await (authClient as unknown as { deleteUser?: (input: { callbackURL: string }) => Promise<unknown> }).deleteUser?.({ callbackURL: '/' });
          setTrackUserId(null);
          setSheet(null);
        }),
      },
    ]);
  }

  async function signOut() {
    await withBusy('sign-out', async () => {
      await authClient.signOut();
      setTrackUserId(null);
      setActiveProjectId(null);
      setActiveGroupId(null);
      setRoute('projects');
      setSheet(null);
    });
  }

  const renderThreadItem = useCallback<ListRenderItem<ThreadItem>>(
    ({ item }) => (
      <ThreadRow
        item={item}
        onReply={(message) => setReplyTo(message)}
        onReport={() => setReportTarget(item)}
      />
    ),
    [],
  );

  if (session.isPending && !devAuthBypass.enabled) {
    return <CenteredState label="Checking your session" />;
  }

  if (!hasSessionAccess) {
    const showAppleSignIn = Platform.OS !== 'android';
    return (
      <SignInScreen
        busyAction={busyAction}
        error={uiError}
        onAction={() => void signInWithProvider('google')}
        onSecondaryAction={showAppleSignIn ? () => void signInWithProvider('apple') : undefined}
        secondaryVisible={showAppleSignIn}
        tertiaryVisible={devAuthBypass.allowed}
        onTertiaryAction={devAuthBypass.enable}
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          style={styles.flex}>
          <Header
            activeGroup={activeGroup?.group ?? null}
            activeProject={activeProject?.project ?? null}
            route={route}
            onBack={() => {
              if (route === 'conversation') setRoute('groups');
              else if (route === 'groups') setRoute('projects');
            }}
            onOpenGroups={() => setSheet('group-switcher')}
            onOpenTools={() => setSheet('tools')}
          />

          {uiError ? (
            <Pressable onPress={() => setUiError(null)} style={[styles.error, { borderColor: theme.hairline }]}>
              <ThemedText type="small">{uiError}</ThemedText>
            </Pressable>
          ) : null}

          {route === 'projects' ? (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={projectItems}
              keyExtractor={(item) => item.project._id}
              renderItem={({ item }) => (
                <ProjectRow
                  item={item}
                  onPress={() => {
                    setActiveProjectId(item.project._id);
                    setRoute('groups');
                  }}
                />
              )}
              ListEmptyComponent={<EmptyState label="No Projects yet" />}
            />
          ) : null}

          {route === 'groups' ? (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={groupItems}
              keyExtractor={(item) => item.group._id}
              renderItem={({ item }) => (
                <GroupRow
                  item={item}
                  onPress={() => {
                    setActiveGroupId(item.group._id);
                    setRoute('conversation');
                  }}
                />
              )}
              ListEmptyComponent={<EmptyState label="No Groups visible" />}
            />
          ) : null}

          {route === 'conversation' ? (
            <>
              <FlatList
                ref={listRef}
                contentContainerStyle={styles.threadContent}
                data={threadItems}
                initialNumToRender={24}
                keyExtractor={(item) => item.key}
                maxToRenderPerBatch={16}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                renderItem={renderThreadItem}
                removeClippedSubviews={Platform.OS === 'android'}
                windowSize={9}
                ListEmptyComponent={<EmptyState label="Start the conversation" />}
              />
              <View style={[styles.composerWrap, { borderTopColor: theme.hairline }]}>
                {replyTo ? (
                  <View style={[styles.replyPreview, { borderColor: theme.accent }]}>
                    <View style={styles.flex}>
                      <ThemedText type="code" themeColor="textSecondary">Replying to {replyTo.author?.displayName ?? 'Member'}</ThemedText>
                      <ThemedText numberOfLines={1} type="small">{replyTo.message.body}</ThemedText>
                    </View>
                    <IconButton icon="close" label="Cancel reply" onPress={() => setReplyTo(null)} />
                  </View>
                ) : null}
                <View style={styles.composer}>
                  <IconButton icon="paperclip" label="Attach file" onPress={attachDocument} />
                  <IconButton
                    active={recordingState.isRecording}
                    icon={recordingState.isRecording ? 'stop' : 'microphone-outline'}
                    label={recordingState.isRecording ? 'Stop recording' : 'Record voice note'}
                    onPress={toggleRecording}
                  />
                  <TextInput
                    allowFontScaling={false}
                    multiline
                    onChangeText={setComposer}
                    placeholder={`Message ${activeGroup?.group.name ?? 'Group'} or ask @track...`}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.composerInput, { borderColor: theme.hairline, color: theme.text, backgroundColor: theme.background }]}
                    value={composer}
                  />
                  <IconButton disabled={busyAction === 'send-message'} icon="arrow-up" label="Send message" onPress={sendMessage} tone="filled" />
                </View>
              </View>
            </>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <OptionsSheet visible={sheet === 'group-switcher'} title="Switch Group" onClose={() => setSheet(null)}>
        {groupItems.map((item) => (
          <GroupRow
            compact
            item={item}
            key={item.group._id}
            onPress={() => {
              setActiveGroupId(item.group._id);
              setRoute('conversation');
              setSheet(null);
            }}
          />
        ))}
      </OptionsSheet>

      <OptionsSheet visible={sheet === 'tools'} title="Project Tools" onClose={() => setSheet(null)}>
        <ToolSection title="Notifications">
          {(['all', 'mentions', 'none'] as const).map((mode) => (
            <ActionRow
              key={mode}
              label={`Global: ${mode}`}
              selected={globalNotificationMode === mode}
              onPress={() => trackUserId ? void setGlobalNotificationMode({ userId: trackUserId, mode }) : undefined}
            />
          ))}
          {(['inherit', 'all', 'mentions', 'none'] as const).map((mode) => (
            <ActionRow
              key={mode}
              label={`This Group: ${mode}`}
              selected={groupNotificationMode === mode}
              onPress={() => trackUserId && activeGroupId ? void setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode }) : undefined}
            />
          ))}
        </ToolSection>
        <ToolSection title="Account">
          <ActionRow icon="account-edit-outline" label="Edit profile" onPress={() => setSheet('profile')} />
          <ActionRow icon="shield-lock-outline" label="Privacy policy" onPress={() => void Linking.openURL('https://track.q9labs.ai/privacy')} />
          <ActionRow icon="file-document-outline" label="Terms" onPress={() => void Linking.openURL('https://track.q9labs.ai/terms')} />
          <ActionRow icon="email-outline" label="Support" onPress={() => void Linking.openURL('mailto:q9labs.ai@gmail.com')} />
          <ActionRow icon="logout" label="Sign out" onPress={() => void signOut()} />
          <ActionRow destructive icon="trash-can-outline" label="Delete account" onPress={confirmDeletion} />
        </ToolSection>
      </OptionsSheet>

      <OptionsSheet visible={sheet === 'profile'} title="Profile Setup" onClose={() => profileStatus?.complete ? setSheet(null) : undefined}>
        <SheetInput label="Name" value={profileDraft.displayName} onChangeText={(displayName) => setProfileDraft((draft) => ({ ...draft, displayName }))} />
        <SheetInput label="Designation" value={profileDraft.profileDesignation} onChangeText={(profileDesignation) => setProfileDraft((draft) => ({ ...draft, profileDesignation }))} />
        <SheetInput label="Timezone" value={profileDraft.timezone} onChangeText={(timezone) => setProfileDraft((draft) => ({ ...draft, timezone }))} />
        <PrimaryButton disabled={busyAction === 'profile'} label="Save Profile" onPress={submitProfile} />
      </OptionsSheet>

      <OptionsSheet visible={sheet === 'two-factor'} title="Two-Factor" onClose={() => setSheet(null)}>
        <View style={styles.segmented}>
          {(['totp', 'backup_code'] as const).map((method) => (
            <Pressable
              key={method}
              onPress={() => setTwoFactorMethod(method)}
              style={[styles.segment, { backgroundColor: twoFactorMethod === method ? theme.accentSoft : theme.background, borderColor: theme.hairline }]}>
              <ThemedText type="code">{method === 'totp' ? 'Authenticator' : 'Backup Code'}</ThemedText>
            </Pressable>
          ))}
        </View>
        <SheetInput label="Code" value={twoFactorCode} onChangeText={setTwoFactorCode} />
        <PrimaryButton disabled={busyAction === 'two-factor'} label="Verify" onPress={submitTwoFactor} />
      </OptionsSheet>

      <OptionsSheet visible={Boolean(reportTarget)} title="Report" onClose={() => setReportTarget(null)}>
        <View style={styles.reasonGrid}>
          {reportReasons.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setReportReason(reason)}
              style={[styles.reasonButton, { borderColor: reportReason === reason ? theme.accent : theme.hairline, backgroundColor: reportReason === reason ? theme.accentSoft : theme.background }]}>
              <ThemedText type="code">{reason}</ThemedText>
            </Pressable>
          ))}
        </View>
        <SheetInput label="Note" multiline value={reportNote} onChangeText={setReportNote} />
        <PrimaryButton disabled={busyAction === 'report'} label="Submit Report" onPress={submitReport} />
      </OptionsSheet>
    </ThemedView>
  );
}

function Header({
  activeGroup,
  activeProject,
  onBack,
  onOpenGroups,
  onOpenTools,
  route,
}: {
  activeGroup: Doc<'groups'> | null;
  activeProject: Doc<'projects'> | null;
  onBack: () => void;
  onOpenGroups: () => void;
  onOpenTools: () => void;
  route: 'projects' | 'groups' | 'conversation';
}) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
      {route !== 'projects' ? (
        <IconButton icon="chevron-left" label="Back" onPress={onBack} />
      ) : (
        <TrackMark size="small" />
      )}
      <Pressable disabled={route !== 'conversation'} onPress={onOpenGroups} style={styles.headerTitle}>
        <ThemedText type="code" themeColor="textSecondary">
          {activeProject?.clientLabel ?? activeProject?.name ?? 'Q9 Track'}
        </ThemedText>
        <View style={styles.headerTitleRow}>
          <ThemedText numberOfLines={1} type="subtitle">
            {route === 'projects' ? 'Projects' : route === 'groups' ? 'Groups' : activeGroup?.name ?? 'Conversation'}
          </ThemedText>
          {route === 'conversation' ? <MaterialCommunityIcons color={theme.text} name="chevron-down" size={22} /> : null}
        </View>
      </Pressable>
      <IconButton icon="dots-horizontal" label="Project tools" onPress={onOpenTools} />
    </View>
  );
}

function ProjectRow({ item, onPress }: { item: MobileProject; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor: theme.hairline, backgroundColor: theme.backgroundElement }]}>
      <RowIcon icon="briefcase-outline" label={item.project.name.slice(0, 1)} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">{item.project.name}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">{item.membership.role} / {item.groupCount} Groups</ThemedText>
      </View>
      <UnreadBadge count={item.unreadCount} />
    </Pressable>
  );
}

function GroupRow({ compact, item, onPress }: { compact?: boolean; item: MobileGroup; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, compact && styles.compactRow, { borderColor: theme.hairline, backgroundColor: theme.backgroundElement }]}>
      <RowIcon icon="forum-outline" label={item.group.name.slice(0, 1)} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">{item.group.name}</ThemedText>
        <ThemedText numberOfLines={1} type="code" themeColor="textSecondary">
          {item.group.kind} / {item.lastMessage?.body || 'No messages yet'}
        </ThemedText>
      </View>
      <UnreadBadge count={item.unreadCount} />
    </Pressable>
  );
}

function ThreadRow({ item, onReply, onReport }: { item: ThreadItem; onReply: (message: DetailedMessage) => void; onReport: () => void }) {
  const theme = useTheme();
  if (item.kind === 'assistant') {
    return (
      <Pressable onLongPress={onReport} style={styles.messageRow}>
        <Avatar label="T" />
        <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
          <View style={styles.messageMeta}>
            <ThemedText type="smallBold">Track Assistant</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">{formatTime(item.stream.createdAt)}</ThemedText>
          </View>
          <ThemedText type="small">{item.stream.answer || item.stream.status}</ThemedText>
          {item.stream.evidence.length > 0 ? (
            <View style={styles.sourceRow}>
              {item.stream.evidence.slice(0, 3).map((evidence, index) => (
                <View key={`${item.stream._id}-${index}`} style={[styles.sourceChip, { borderColor: theme.hairline }]}>
                  <ThemedText numberOfLines={1} type="code">Source {index + 1}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const authorName = item.item.author?.displayName ?? 'Unknown Member';
  return (
    <Pressable onLongPress={onReport} style={styles.messageRow}>
      <Avatar label={authorName.slice(0, 1)} />
      <View style={[styles.messageBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
        <View style={styles.messageMeta}>
          <View style={styles.metaLeft}>
            <ThemedText type="smallBold">{authorName}</ThemedText>
            {item.item.authorRole ? <RoleChip role={item.item.authorRole} /> : null}
          </View>
          <ThemedText type="code" themeColor="textSecondary">{formatTime(item.item.message.createdAt)}</ThemedText>
        </View>
        {item.item.replyTo ? (
          <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
            <ThemedText type="code" themeColor="textSecondary">{item.item.replyTo.authorName}</ThemedText>
            <ThemedText numberOfLines={2} type="small">{item.item.replyTo.body}</ThemedText>
          </View>
        ) : null}
        <ThemedText type="small">{item.item.message.body}</ThemedText>
        {item.item.attachments.map(({ attachment, url }) => (
          attachment.kind === 'voice_note' && url ? (
            <VoiceAttachment attachment={attachment} key={attachment._id} url={url} />
          ) : (
            <View key={attachment._id} style={[styles.attachment, { borderColor: theme.hairline }]}>
              <ThemedText numberOfLines={1} type="code">{attachment.filename}</ThemedText>
            </View>
          )
        ))}
        <View style={styles.messageActions}>
          <Pressable onPress={() => onReply(item.item)}><ThemedText type="code" themeColor="textSecondary">Reply</ThemedText></Pressable>
          <Pressable onPress={onReport}><ThemedText type="code" themeColor="textSecondary">Report</ThemedText></Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function VoiceAttachment({ attachment, url }: { attachment: Doc<'attachments'>; url: string }) {
  const theme = useTheme();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  return (
    <Pressable onPress={() => status.playing ? player.pause() : player.play()} style={[styles.attachment, styles.voiceAttachment, { borderColor: theme.accent }]}>
      <ThemedText type="smallBold">{status.playing ? 'Pause' : 'Play'}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {attachment.durationMs ? `${Math.round(attachment.durationMs / 1000)}s` : 'Voice note'}
      </ThemedText>
    </Pressable>
  );
}

function OptionsSheet({ children, onClose, title, visible }: { children: React.ReactNode; onClose: () => void; title: string; visible: boolean }) {
  const theme = useTheme();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.scrim} />
      <ThemedView style={[styles.sheet, { borderTopColor: theme.hairline }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.sheetScroll}>
          {children}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function SignInScreen({
  busyAction,
  error,
  onAction,
  onSecondaryAction,
  onTertiaryAction,
  secondaryVisible,
  tertiaryVisible,
}: {
  busyAction?: string | null;
  error?: string | null;
  onAction: () => void;
  onSecondaryAction?: () => void;
  onTertiaryAction?: () => void;
  secondaryVisible?: boolean;
  tertiaryVisible?: boolean;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.signInScreen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.signInTop}>
          <TrackMark />
          <View style={styles.signInBrandText}>
            <ThemedText type="code" themeColor="textSecondary">Q9 Labs</ThemedText>
            <ThemedText type="title">Track</ThemedText>
          </View>
        </View>

        <View style={[styles.signInPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
          <ThemedText type="subtitle">Sign in to Track</ThemedText>
          {error ? (
            <View style={[styles.signInError, { backgroundColor: theme.background, borderColor: '#dc2626' }]}>
              <ThemedText type="small">{error}</ThemedText>
            </View>
          ) : null}
          <OAuthButton disabled={busyAction !== null} image={googleMarkImage} label="Continue with Google" onPress={onAction} />
          {secondaryVisible ? (
            <OAuthButton disabled={busyAction !== null} icon="apple" label="Continue with Apple" onPress={onSecondaryAction} />
          ) : null}
          {tertiaryVisible ? (
            <Pressable onPress={onTertiaryAction} style={[styles.demoButton, { borderColor: theme.hairline }]}>
              <MaterialCommunityIcons color={theme.textSecondary} name="flask-outline" size={18} />
              <ThemedText type="smallBold">Use Hasan Demo</ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.signInLinks}>
          <Pressable onPress={() => void Linking.openURL('https://track.q9labs.ai/privacy')}>
            <ThemedText type="code" themeColor="textSecondary">Privacy</ThemedText>
          </Pressable>
          <View style={[styles.linkDot, { backgroundColor: theme.hairline }]} />
          <Pressable onPress={() => void Linking.openURL('https://track.q9labs.ai/terms')}>
            <ThemedText type="code" themeColor="textSecondary">Terms</ThemedText>
          </Pressable>
          <View style={[styles.linkDot, { backgroundColor: theme.hairline }]} />
          <Pressable onPress={() => void Linking.openURL('mailto:q9labs.ai@gmail.com')}>
            <ThemedText type="code" themeColor="textSecondary">Support</ThemedText>
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
  onSecondaryAction,
  onTertiaryAction,
  secondaryActionLabel,
  tertiaryActionLabel,
}: {
  actionLabel?: string;
  label: string;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  onTertiaryAction?: () => void;
  secondaryActionLabel?: string;
  tertiaryActionLabel?: string;
}) {
  return (
    <ThemedView style={styles.centered}>
      <TrackMark />
      <ThemedText type="subtitle">{label}</ThemedText>
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
      {secondaryActionLabel ? <SecondaryButton label={secondaryActionLabel} onPress={onSecondaryAction} /> : null}
      {tertiaryActionLabel ? <SecondaryButton label={tertiaryActionLabel} onPress={onTertiaryAction} /> : null}
    </ThemedView>
  );
}

function OAuthButton({
  disabled,
  icon,
  image,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon?: IconName;
  image?: ImageSourcePropType;
  label: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.oauthButton, { backgroundColor: theme.text, opacity: disabled ? 0.62 : 1 }]}>
      {image ? (
        <Image accessibilityIgnoresInvertColors source={image} style={styles.oauthImage} />
      ) : icon ? (
        <MaterialCommunityIcons color={theme.background} name={icon} size={20} />
      ) : null}
      <ThemedText style={{ color: theme.background }} type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function TrackMark({ size = 'large' }: { size?: 'small' | 'large' }) {
  const theme = useTheme();
  const compact = size === 'small';
  const source = theme.background === '#1b1917' ? trackMarkReversedImage : trackMarkImage;
  return (
    <View style={[styles.trackMark, compact && styles.trackMarkSmall]}>
      <Image accessibilityIgnoresInvertColors resizeMode="contain" source={source} style={styles.trackMarkImage} />
    </View>
  );
}

function IconButton({
  active,
  disabled,
  icon,
  label,
  onPress,
  tone = 'plain',
}: {
  active?: boolean;
  disabled?: boolean;
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'plain' | 'filled';
}) {
  const theme = useTheme();
  const filled = tone === 'filled';
  const backgroundColor = filled ? theme.text : active ? theme.accentSoft : 'transparent';
  const borderColor = active ? theme.accent : filled ? theme.text : theme.hairline;
  const color = filled ? theme.background : active ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor, borderColor, opacity: disabled ? 0.48 : 1 }]}>
      <MaterialCommunityIcons color={color} name={icon} size={21} />
    </Pressable>
  );
}

function RowIcon({ icon, label }: { icon: IconName; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.rowIcon, { backgroundColor: theme.backgroundSelected }]}>
      <MaterialCommunityIcons color={theme.textSecondary} name={icon} size={20} />
      <ThemedText style={styles.rowIconLabel} type="code">{label.toUpperCase()}</ThemedText>
    </View>
  );
}

function ActionRow({ destructive, icon, label, onPress, selected }: { destructive?: boolean; icon?: IconName; label: string; onPress?: () => void; selected?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.actionRow, { borderColor: selected ? theme.accent : theme.hairline }]}>
      <View style={styles.actionLabel}>
        {icon ? <MaterialCommunityIcons color={destructive ? '#b91c1c' : theme.textSecondary} name={icon} size={19} /> : null}
        <ThemedText type="smallBold" style={destructive ? { color: '#b91c1c' } : undefined}>{label}</ThemedText>
      </View>
      {selected ? <MaterialCommunityIcons color={theme.accent} name="check-circle" size={19} /> : null}
    </Pressable>
  );
}

function ToolSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.toolSection}>
      <ThemedText type="code" themeColor="textSecondary">{title}</ThemedText>
      {children}
    </View>
  );
}

function SheetInput({ label, multiline, onChangeText, value }: { label: string; multiline?: boolean; onChangeText: (value: string) => void; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sheetInputWrap}>
      <ThemedText type="code" themeColor="textSecondary">{label}</ThemedText>
      <TextInput
        allowFontScaling={false}
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.sheetInput, multiline && styles.sheetTextArea, { borderColor: theme.hairline, color: theme.text }]}
        value={value}
      />
    </View>
  );
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, { backgroundColor: disabled ? theme.hairline : theme.accent }]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.secondaryButton, { borderColor: theme.hairline }]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const theme = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.unreadBadge, { backgroundColor: theme.accent }]}>
      <ThemedText type="code">{count > 99 ? '99+' : String(count)}</ThemedText>
    </View>
  );
}

function Avatar({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { borderColor: theme.hairline, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{label.toUpperCase()}</ThemedText>
    </View>
  );
}

function RoleChip({ role }: { role: Doc<'projectMembers'>['role'] }) {
  const theme = useTheme();
  return (
    <View style={[styles.roleChip, { borderColor: theme.hairline }]}>
      <ThemedText type="code" themeColor="textSecondary">{role}</ThemedText>
    </View>
  );
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function resolveMentionIds(body: string, members: ProjectMemberRow[]) {
  const mentionTokens = parseMentions(body).filter((token) => token !== 'track');
  if (mentionTokens.length === 0) return [];
  const tokenSet = new Set(mentionTokens.map(normalizeMentionKey));
  const userIds = new Set<Id<'users'>>();

  for (const member of members) {
    if (!member.user) continue;
    const keys = new Set([
      member.user.displayName,
      member.user.email,
      member.user.email?.split('@')[0],
    ].filter(Boolean).map((value) => normalizeMentionKey(String(value))));
    if ([...keys].some((key) => tokenSet.has(key))) userIds.add(member.user._id);
  }

  return [...userIds];
}

function normalizeMentionKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: Spacing.four,
  },
  actionLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    minWidth: 0,
  },
  assistantBubble: {
    borderColor: '#f0b100',
  },
  assistantRow: {
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.three,
  },
  attachment: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    padding: Spacing.five,
  },
  compactRow: {
    marginBottom: Spacing.two,
    minHeight: 60,
  },
  composer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  composerInput: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    maxHeight: 112,
    minHeight: 42,
    paddingHorizontal: Spacing.four,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  composerWrap: {
    borderTopWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  demoButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.four,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.six,
  },
  error: {
    borderBottomWidth: 1,
    padding: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    minWidth: 0,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  linkDot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  listContent: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  messageActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  messageBubble: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: Spacing.three,
  },
  messageMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  messageRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  metaLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: Spacing.two,
  },
  oauthButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: Spacing.four,
  },
  oauthImage: {
    height: 20,
    width: 20,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  quote: {
    borderLeftWidth: 3,
    marginVertical: Spacing.two,
    paddingLeft: Spacing.two,
  },
  reasonButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  replyPreview: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  roleChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  roundButton: {
    alignItems: 'center',
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 72,
    padding: Spacing.three,
  },
  rowInitial: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowIconLabel: {
    fontSize: 8,
    marginTop: 1,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: Spacing.three,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    bottom: 0,
    gap: Spacing.three,
    left: 0,
    maxHeight: '82%',
    padding: Spacing.four,
    position: 'absolute',
    right: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#a8a29e',
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sheetInput: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sheetInputWrap: {
    gap: Spacing.one,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetTextArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  signInBrandText: {
    gap: Spacing.one,
  },
  signInLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
  },
  signInPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    padding: Spacing.four,
  },
  signInError: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  signInScreen: {
    flex: 1,
  },
  signInTop: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.four,
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: Spacing.five,
  },
  sourceChip: {
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: 120,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  threadContent: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  toolSection: {
    gap: Spacing.two,
  },
  trackMark: {
    alignItems: 'center',
    height: 124,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 124,
  },
  trackMarkSmall: {
    height: 48,
    width: 48,
  },
  trackMarkImage: {
    height: '100%',
    width: '100%',
  },
  unreadBadge: {
    alignItems: 'center',
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  voiceAttachment: {
    gap: Spacing.three,
  },
});
