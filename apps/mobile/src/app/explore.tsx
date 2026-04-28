import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function RecordScreen() {
  const theme = useTheme();
  const session = authClient.useSession();
  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser);
  const requestExport = useMutation(api.exports.request);
  const updateRecordStatus = useMutation(api.records.updateStatus);
  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null);
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const trackUser = useQuery(api.auth.getCurrentUser);
  const projects = useQuery(api.projects.list, trackUserId ? { userId: trackUserId } : 'skip');
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );
  const exports = useQuery(
    api.exports.list,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId } : 'skip',
  );
  const auditEvents = useQuery(
    api.audit.listProjectEvents,
    trackUserId && activeProjectId ? { userId: trackUserId, projectId: activeProjectId, limit: 50 } : 'skip',
  );
  const exportDownloadUrl = useQuery(
    api.exports.getDownloadUrl,
    trackUserId && latestExportId ? { userId: trackUserId, exportId: latestExportId } : 'skip',
  );

  const projectItems = useMemo(
    () =>
      (projects ?? []) as Array<{
        project: Doc<'projects'>;
        membership: Doc<'projectMembers'>;
      }>,
    [projects],
  );
  const projectRecords = useMemo(() => (records ?? []) as Array<Doc<'records'>>, [records]);
  const projectExports = useMemo(() => (exports ?? []) as Array<Doc<'exports'>>, [exports]);
  const projectAuditEvents = useMemo(() => (auditEvents ?? []) as Array<Doc<'auditEvents'>>, [auditEvents]);
  const activeProject = projectItems.find((item) => item.project._id === activeProjectId);
  const latestCompletedExport = projectExports.find((exportJob) => exportJob.status === 'completed') ?? null;

  useEffect(() => {
    if (!session.data || trackUserId) return;
    void ensureCurrentUser().then(setTrackUserId).catch(setActionError);
  }, [ensureCurrentUser, session.data, trackUserId]);

  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) setTrackUserId(trackUser._id);
  }, [trackUser?._id, trackUserId]);

  useEffect(() => {
    if (!projectItems.length || activeProjectId) return;
    setActiveProjectId(projectItems[0]?.project._id ?? null);
  }, [activeProjectId, projectItems]);

  useEffect(() => {
    if (!latestCompletedExport || latestExportId) return;
    setLatestExportId(latestCompletedExport._id);
  }, [latestCompletedExport, latestExportId]);

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

  async function createExport(format: 'csv' | 'pdf') {
    if (!trackUserId || !activeProjectId) return;
    await withBusy(`export-${format}`, async () => {
      const exportId = await requestExport({
        projectId: activeProjectId,
        userId: trackUserId,
        format,
        preset: format === 'pdf' ? 'full_audit_packet' : 'client_summary',
      });
      setLatestExportId(exportId);
    });
  }

  async function setRecordStatus(
    recordId: Id<'records'>,
    status: 'open' | 'in_progress' | 'blocked' | 'done',
  ) {
    if (!trackUserId || !activeProjectId) return;
    await withBusy(`record-${recordId}`, async () => {
      await updateRecordStatus({ projectId: activeProjectId, actorId: trackUserId, recordId, status });
    });
  }

  if (session.isPending) return <CenteredState label="Checking your session" />;
  if (!session.data) {
    return (
      <CenteredState
        actionLabel="Continue with Google"
        label="Sign in to view the Project Record"
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
              Project Record
            </ThemedText>
            <ThemedText type="subtitle">{activeProject?.project.name ?? 'Track'}</ThemedText>
          </View>
          <Pressable onPress={() => void createExport('pdf')} style={[styles.exportButton, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              PDF
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          {uiError ? (
            <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.hairline }]}>
              <ThemedText type="small">{uiError}</ThemedText>
            </ThemedView>
          ) : null}

          <ScrollView horizontal contentContainerStyle={styles.projectRail} showsHorizontalScrollIndicator={false}>
            {projectItems.map((item) => (
              <Pressable key={item.project._id} onPress={() => setActiveProjectId(item.project._id)}>
                <ThemedView
                  type={item.project._id === activeProjectId ? 'backgroundSelected' : 'backgroundElement'}
                  style={[
                    styles.projectPill,
                    { borderColor: item.project._id === activeProjectId ? theme.accent : theme.hairline },
                  ]}>
                  <ThemedText type="smallBold">{item.project.name}</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {item.membership.role}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.metrics}>
            <Metric label="Records" value={projectRecords.length} />
            <Metric
              label="Billable"
              value={projectRecords.filter((record) => record.classification === 'billable_scope').length}
            />
            <Metric
              label="Open"
              value={projectRecords.filter((record) => record.status !== 'done').length}
            />
          </View>

          <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.hairline }]}>
            <ThemedText type="code" themeColor="textSecondary">
              Exports
            </ThemedText>
            <View style={styles.actions}>
              <Pressable
                disabled={busyAction === 'export-csv'}
                onPress={() => void createExport('csv')}
                style={[styles.actionButton, { borderColor: theme.hairline }]}>
                <ThemedText type="code">CSV</ThemedText>
              </Pressable>
              <Pressable
                disabled={busyAction === 'export-pdf'}
                onPress={() => void createExport('pdf')}
                style={[styles.actionButton, { borderColor: theme.hairline }]}>
                <ThemedText type="code">PDF</ThemedText>
              </Pressable>
              {exportDownloadUrl ? (
                <Pressable onPress={() => void Linking.openURL(exportDownloadUrl)} style={[styles.actionButton, { borderColor: theme.accent }]}>
                  <ThemedText type="code">Download</ThemedText>
                </Pressable>
              ) : latestExportId ? (
                <ThemedText type="code" themeColor="textSecondary">
                  Preparing export
                </ThemedText>
              ) : null}
            </View>
            {projectExports.slice(0, 4).map((exportJob) => (
              <ThemedText key={exportJob._id} type="small" themeColor="textSecondary">
                {exportJob.format} / {exportJob.preset} / {exportJob.status}
              </ThemedText>
            ))}
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="code" themeColor="textSecondary">
              Accepted Records
            </ThemedText>
            {projectRecords.map((record) => (
              <ThemedView key={record._id} type="backgroundElement" style={[styles.record, { borderColor: theme.hairline }]}>
                <View style={styles.recordMeta}>
                  <ThemedText type="code" themeColor="textSecondary">
                    {record._id.slice(-6)}
                  </ThemedText>
                  <ThemedView style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="code">{record.classification}</ThemedText>
                  </ThemedView>
                </View>
                <ThemedText type="smallBold">{record.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {record.type} / {record.status}
                </ThemedText>
                <View style={styles.actions}>
                  {(['open', 'in_progress', 'blocked', 'done'] as const).map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => void setRecordStatus(record._id, status)}
                      style={[styles.actionButton, { borderColor: record.status === status ? theme.accent : theme.hairline }]}>
                      <ThemedText type="code">{status}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ThemedView>
            ))}
          </View>

          <View style={styles.section}>
            <ThemedText type="code" themeColor="textSecondary">
              Audit Trail
            </ThemedText>
            {projectAuditEvents.map((event) => (
              <ThemedView key={event._id} type="backgroundElement" style={[styles.auditItem, { borderColor: theme.hairline }]}>
                <ThemedText type="smallBold">{event.action}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {event.entityType} / {new Date(event.createdAt).toLocaleString()}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>
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
        Track Record
      </ThemedText>
      <ThemedText type="subtitle">{label}</ThemedText>
      {actionLabel ? (
        <Pressable onPress={onAction} style={[styles.exportButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: '#1b1917' }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
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
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerTitle: { flex: 1 },
  exportButton: {
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  projectRail: {
    gap: Spacing.two,
  },
  projectPill: {
    minWidth: 148,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
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
    minWidth: 96,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  record: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  auditItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
