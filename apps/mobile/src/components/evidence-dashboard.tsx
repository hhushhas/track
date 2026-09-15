import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';

export type EvidenceKind = 'assistant_answer' | 'attachment' | 'memory_excerpt' | 'message' | 'search_file' | 'search_message';

export type EvidenceAuditItem = {
  actor?: string;
  availability?: 'available' | 'redacted' | 'unavailable';
  body: string;
  createdAt?: number;
  id: string;
  kind: EvidenceKind;
  location?: string;
  opensTask?: boolean;
  primary?: boolean;
  taskKey?: string;
  title: string;
};

export function EvidenceProtocolIntro() {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.25;
  return <View style={styles.protocol}>
    <View style={[styles.protocolMeta, largeText && styles.protocolMetaLarge]}>
      <ThemedText themeColor="accentStrong" type="captionBold">Evidence scope</ThemedText>
      <View style={styles.live}><View style={[styles.liveDot, { backgroundColor: theme.accent }]} /><ThemedText themeColor="textSecondary" type="captionBold">Live session</ThemedText></View>
    </View>
    <ThemedText themeColor="textSecondary" type="small">Find the source behind tasks and decisions. Evidence is permission-scoped to verified contributors.</ThemedText>
  </View>;
}

export function EvidenceScopeCard({ channelCount, channelName, companyName, onChannelPress, onProjectPress, projectName }: {
  channelCount: number;
  channelName?: string;
  companyName?: string;
  onChannelPress: () => void;
  onProjectPress: () => void;
  projectName?: string;
}) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.25;
  const filters = Number(Boolean(projectName)) + Number(Boolean(channelName));
  return <View style={[styles.scopeCard, { backgroundColor: theme.backgroundElevated }]}>
    <View style={[styles.scopeHead, largeText && styles.scopeHeadLarge]}>
      <View style={styles.scopeTitle}><PlatformIcon color={theme.accentStrong} name="shield-check" size={17} /><ThemedText type="captionBold">ACTIVE SCOPE</ThemedText></View>
      <ThemedText themeColor="accentStrong" type="captionBold">{filters ? `${filters} ${filters === 1 ? 'filter' : 'filters'}` : 'Project required'}</ThemedText>
    </View>
    <ScopeField detail={companyName ?? 'Choose the Company context'} icon="project" label="PROJECT (REQUIRED)" onPress={onProjectPress} placeholder="Choose a Project" value={projectName} />
    {projectName ? <ScopeField detail={channelName ? 'Only this Channel' : `${channelCount} accessible ${channelCount === 1 ? 'Channel' : 'Channels'}`} icon="channel" label="CHANNEL (OPTIONAL)" onPress={onChannelPress} placeholder="All accessible Channels" value={channelName ? `#${channelName}` : undefined} /> : null}
    {projectName ? <View style={[styles.lockNote, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="shield-lock-outline" size={16} /><ThemedText style={styles.flex} themeColor="textSecondary" type="caption">Locked to {companyName ?? 'Project'} member permissions. {channelCount} {channelCount === 1 ? 'Channel' : 'Channels'} accessible.</ThemedText></View> : null}
  </View>;
}

function ScopeField({ detail, icon, label, onPress, placeholder, value }: { detail: string; icon: IconName; label: string; onPress: () => void; placeholder: string; value?: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.25;
  return <Pressable accessibilityHint={`Opens the ${label.toLowerCase()} picker`} accessibilityLabel={`${label}: ${value ?? placeholder}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [styles.scopeField, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.72 : 1 }]}>
    <View style={[styles.scopeIcon, { backgroundColor: value ? theme.text : theme.backgroundSelected }]}><PlatformIcon color={value ? theme.background : theme.textSecondary} name={icon} size={18} /></View>
    <View style={styles.scopeCopy}><ThemedText style={styles.fieldLabel} themeColor="textTertiary" type="captionBold">{label}</ThemedText><ThemedText numberOfLines={largeText ? 2 : 1} type="smallBold">{value ?? placeholder}</ThemedText><ThemedText numberOfLines={largeText ? 2 : 1} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>
    <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
  </Pressable>;
}

export function EvidenceResultsHeader({ count, searching }: { count: number; searching: boolean }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.25;
  return <View style={[styles.resultsHead, largeText && styles.resultsHeadLarge]}>
    <View style={styles.resultsTitle}><ThemedText type="captionBold">{searching ? 'SEARCH RESULTS' : 'FILTERED RECORDS'}</ThemedText><ThemedText themeColor="textTertiary" type="captionBold">{count} {count === 1 ? 'record' : 'records'}</ThemedText></View>
    <View style={styles.sortLabel}><PlatformIcon color={theme.accentStrong} name="sort" size={15} /><ThemedText themeColor="accentStrong" type="captionBold">Most recent</ThemedText></View>
  </View>;
}

export function EvidenceAuditCard({ item, onOpenSource, onOpenTask }: { item: EvidenceAuditItem; onOpenSource: () => void; onOpenTask?: () => void }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const config = kindConfig(item.kind);
  const restricted = item.availability === 'redacted' || item.availability === 'unavailable';
  const primaryAction = restricted ? 'Restricted source' : item.opensTask ? 'Open linked task' : 'Open exact source';
  return <View style={[styles.auditCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
    <View style={[styles.auditRail, { backgroundColor: config.accent ? theme.accent : theme.hairline }]} />
    <Pressable accessibilityHint={restricted ? 'The source is outside your current access' : item.opensTask ? 'Opens the linked task because this reference has no conversation source' : 'Opens the exact evidence source'} accessibilityLabel={`${config.label}. ${item.title}. ${item.body}`} accessibilityRole={restricted ? 'text' : 'button'} accessibilityState={{ disabled: restricted }} android_ripple={{ color: theme.backgroundSelected }} disabled={restricted} onPress={() => { hapticLight(); onOpenSource(); }} style={({ pressed }) => [styles.auditMain, { opacity: pressed ? 0.72 : 1 }]}>
      <View style={[styles.auditTop, fontScale > 1.25 && styles.auditTopLarge]}>
        <View style={styles.kindBadge}><PlatformIcon color={config.accent ? theme.accentStrong : theme.textSecondary} name={config.icon} size={14} /><ThemedText themeColor={config.accent ? 'accentStrong' : 'textSecondary'} type="captionBold">{config.label}</ThemedText></View>
        <ThemedText themeColor="textTertiary" type="caption">{formatEvidenceDate(item.createdAt)}</ThemedText>
      </View>
      <View style={styles.auditIdentity}><ThemedText numberOfLines={1} style={styles.flex} type="smallBold">{item.actor ?? item.title}</ThemedText>{item.primary ? <ThemedText themeColor="accentStrong" type="captionBold">Primary</ThemedText> : null}</View>
      {item.actor ? <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.location ?? item.title}</ThemedText> : null}
      <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}><ThemedText numberOfLines={5} themeColor={restricted ? 'textTertiary' : 'text'} type="small">{restricted ? 'This reference is no longer available in your current scope.' : item.body}</ThemedText></View>
      <View style={styles.sourceFooter}><View style={styles.sourceAction}><PlatformIcon color={theme.textSecondary} name={restricted ? 'shield-lock-outline' : item.opensTask ? 'check-circle' : 'open-in-new'} size={15} /><ThemedText themeColor="textSecondary" type="captionBold">{primaryAction}</ThemedText></View>{restricted ? null : <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />}</View>
    </Pressable>
    {item.taskKey && onOpenTask ? <Pressable accessibilityLabel={`Open linked task ${item.taskKey}`} accessibilityRole="button" android_ripple={{ color: theme.accentSoft }} onPress={() => { hapticLight(); onOpenTask(); }} style={[styles.taskLink, fontScale > 1.25 && styles.taskLinkLarge, { borderTopColor: theme.hairline }]}><PlatformIcon color={theme.accentStrong} name="check-circle" size={16} /><ThemedText style={styles.flex} themeColor="textSecondary" type="caption">Linked task</ThemedText><ThemedText themeColor="accentStrong" type="mono">{item.taskKey}</ThemedText><PlatformIcon color={theme.accentStrong} name="chevron-right" size={15} /></Pressable> : null}
  </View>;
}

export function EvidenceEndMarker({ companyName }: { companyName?: string }) {
  const theme = useTheme();
  return <View style={styles.endMarker}><View style={[styles.endIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="shield-check" size={20} /></View><ThemedText type="captionBold">END OF SCOPED RECORDS</ThemedText><ThemedText style={styles.endCopy} themeColor="textSecondary" type="caption">Only sources available to your {companyName ?? 'Project'} membership are shown.</ThemedText></View>;
}

function kindConfig(kind: EvidenceKind): { accent: boolean; icon: IconName; label: string } {
  switch (kind) {
    case 'attachment': case 'search_file': return { accent: false, icon: 'file-document-outline', label: 'FILE ATTACHMENT' };
    case 'assistant_answer': return { accent: true, icon: 'lightbulb-outline', label: 'GROUNDED ANSWER' };
    case 'memory_excerpt': return { accent: true, icon: 'archive', label: 'MEMORY EXCERPT' };
    default: return { accent: true, icon: 'message', label: 'MESSAGE REFERENCE' };
  }
}

function formatEvidenceDate(value?: number) {
  if (!value) return 'Source record';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  auditCard: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', position: 'relative' },
  auditIdentity: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  auditMain: { gap: Spacing.two, padding: Spacing.four, paddingLeft: Spacing.four + 2 },
  auditRail: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 2 },
  auditTop: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  auditTopLarge: { alignItems: 'flex-start', flexDirection: 'column' },
  endCopy: { maxWidth: 280, textAlign: 'center' },
  endIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 44, justifyContent: 'center', width: 44 },
  endMarker: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  fieldLabel: { textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
  kindBadge: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: Spacing.one, minHeight: 26 },
  live: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  liveDot: { borderRadius: Radius.pill, height: 7, width: 7 },
  lockNote: { alignItems: 'flex-start', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  protocol: { gap: Spacing.two },
  protocolMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  protocolMetaLarge: { alignItems: 'flex-start', flexDirection: 'column', gap: Spacing.two },
  quote: { borderRadius: Radius.medium, padding: Spacing.three },
  resultsHead: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', paddingTop: Spacing.two },
  resultsHeadLarge: { alignItems: 'flex-start', flexDirection: 'column' },
  resultsTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  scopeCard: { borderCurve: 'continuous', borderRadius: Radius.large, gap: Spacing.two, padding: Spacing.four },
  scopeCopy: { flex: 1, gap: 1, minWidth: 0 },
  scopeField: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.three, minHeight: 68, overflow: 'hidden', padding: Spacing.three },
  scopeHead: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  scopeHeadLarge: { alignItems: 'flex-start', flexDirection: 'column' },
  scopeIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 38, justifyContent: 'center', width: 38 },
  scopeTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  sortLabel: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  sourceAction: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  sourceFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget - Spacing.two },
  taskLink: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  taskLinkLarge: { flexWrap: 'wrap', paddingVertical: Spacing.two },
});
