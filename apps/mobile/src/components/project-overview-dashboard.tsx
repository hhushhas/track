import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AssistantMark } from '@/components/chat/assistant-mark';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { attentionAction, attentionContext, attentionTitle, relativeAttentionTime, type MobileAttentionItem } from '@/lib/mobile-attention';

export function ProjectAccountButton({ label, onPress, seed }: { label: string; onPress: () => void; seed: string }) {
  return <Pressable accessibilityLabel="Open account" accessibilityRole="button" hitSlop={4} onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [styles.accountButton, { opacity: pressed ? 0.62 : 1 }]}>
    <ColoredAvatar label={label} seed={seed} shape="rounded" size={32} />
  </Pressable>;
}

export function ProjectHero({ archived, company, description, memberCount, name, onBack, role }: { archived: boolean; company: string; description?: string; memberCount?: number | string; name: string; onBack: () => void; role: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={styles.hero}>
    <View style={[styles.heroTopline, largeText && styles.heroToplineLarge]}>
      <Pressable accessibilityLabel="Back to Projects" accessibilityRole="button" hitSlop={8} onPress={onBack} style={styles.backLink}><PlatformIcon color={theme.textSecondary} name="chevron-left" size={15} /><ThemedText themeColor="textSecondary" type="caption">Projects</ThemedText></Pressable>
      <View style={styles.statusLine}><ThemedText themeColor={archived ? 'textSecondary' : 'accentStrong'} type="captionBold">{role}</ThemedText><View style={[styles.statusDot, { backgroundColor: archived ? theme.textTertiary : theme.accent }]} /><ThemedText themeColor="textSecondary" type="caption">{archived ? 'Archived' : 'Active'}</ThemedText>{memberCount !== undefined ? <><View style={[styles.statusDot, { backgroundColor: theme.hairline }]} /><ThemedText themeColor="textSecondary" type="caption">{memberCount} {memberCount === 1 || memberCount === '1' ? 'member' : 'members'}</ThemedText></> : null}</View>
    </View>
    <View style={styles.companyLine}><PlatformIcon color={theme.textTertiary} name="office-building" size={12} /><ThemedText numberOfLines={largeText ? undefined : 1} style={styles.company} themeColor="textSecondary" type="captionBold">{company}</ThemedText></View>
    <ThemedText numberOfLines={largeText ? undefined : 2} type="titleLarge">{name}</ThemedText>
    <ThemedText numberOfLines={largeText ? undefined : 3} themeColor="textSecondary" type="caption">{description || 'Conversation, tasks, and references for this Project.'}</ThemedText>
  </View>;
}

export function ProjectMetrics({ channels, people, tasks, tasksEnabled, unread }: { channels: number; people: number | string; tasks: number; tasksEnabled: boolean; unread: number }) {
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.metrics, largeText && styles.metricsLarge]}>
    <Metric detail={`${unread} unread`} emphasis={unread > 0} label="Channels" value={channels} />
    {tasksEnabled ? <Metric detail="open" label="Tasks" value={tasks} /> : null}
    <Metric detail="collabs" label="People" value={people} />
  </View>;
}

function Metric({ detail, emphasis, label, value }: { detail: string; emphasis?: boolean; label: string; value: number | string }) {
  const theme = useTheme();
  return <View style={[styles.metric, { backgroundColor: theme.backgroundElevated }]}><ThemedText style={styles.metricLabel} themeColor="textSecondary" type="captionBold">{label}</ThemedText><View style={styles.metricResult}><ThemedText style={styles.metricValue}>{value}</ThemedText><ThemedText numberOfLines={1} themeColor={emphasis ? 'accentStrong' : 'textSecondary'} type="caption">{detail}</ThemedText></View></View>;
}

export function ProjectWorkHub({ channelCount, dueSoonCount, evidenceCount, onChannels, onEvidence, onTasks, openTaskCount, tasksEnabled, unreadCount }: { channelCount: number; dueSoonCount: number; evidenceCount: number | string; onChannels: () => void; onEvidence: () => void; onTasks: () => void; openTaskCount: number; tasksEnabled: boolean; unreadCount: number }) {
  return <View>
    <SectionHeading title="Continue working" />
    <View style={styles.hub}>
      <HubRow detail={`${channelCount} ${channelCount === 1 ? 'Channel' : 'Channels'}${unreadCount ? ` \u00b7 ${unreadCount} unread` : ''}`} icon="channel" label="Channels" onPress={onChannels} />
      {tasksEnabled ? <HubRow detail={`${openTaskCount} open ${openTaskCount === 1 ? 'task' : 'tasks'}${dueSoonCount ? ` \u00b7 ${dueSoonCount} due in 7 days` : ''}`} icon="view-board" label="Open Board" onPress={onTasks} /> : null}
      <HubRow detail={`${evidenceCount} linked references`} icon="evidence" label="Evidence" onPress={onEvidence} />
    </View>
  </View>;
}

function HubRow({ detail, icon, label, onPress }: { detail: string; icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={`${label}. ${detail}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} key={`${label}:${theme.backgroundElevated}`} onPress={onPress} style={[styles.hubRow, { backgroundColor: theme.backgroundElevated }]}>
    <View style={[styles.hubIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.text} name={icon} size={17} /></View>
    <View style={styles.flex}><ThemedText type="title">{label}</ThemedText><ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>
    <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />
  </Pressable>;
}

export function ProjectAttention({ items, onOpen }: { items: MobileAttentionItem[]; onOpen: (item: MobileAttentionItem) => void }) {
  const theme = useTheme();
  return <View style={styles.attentionSection}>
    <SectionHeading title="Your attention" />
    {items.length ? items.map((item) => <AttentionCard item={item} key={`${item.kind}:${item.id}`} onPress={() => onOpen(item)} />) : <View style={[styles.clearState, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.success} name="check-circle" size={17} /><ThemedText themeColor="textSecondary" type="caption">Nothing else needs your attention in this Project.</ThemedText></View>}
  </View>;
}

function AttentionCard({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  const task = item.kind === 'task';
  const suggestion = item.kind === 'suggestion';
  const message = item.kind === 'message';
  const urgent = task && (item.eventType === 'overdue' || item.eventType === 'due_soon');
  const identity = message ? `${item.senderName} in #${item.groupName}` : task ? item.taskKey : suggestion ? 'Track assistant' : item.companyName;
  const attentionTone = urgent ? theme.danger : message || suggestion ? theme.accent : theme.hairline;
  const actionLabel = suggestion ? 'Review & Create' : task ? 'View Task' : message ? item.threadId ? 'Reply in thread' : 'Open Channel' : 'Review invitation';
  return <View style={[styles.attentionSurface, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline, borderLeftColor: attentionTone }]}>
    <Pressable accessibilityLabel={`${attentionTitle(item)}. ${attentionAction(item)}. ${attentionContext(item)}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.attentionCard, pressed && { backgroundColor: theme.backgroundElement }]}>
    <View style={styles.attentionTopline}>
      <View style={styles.attentionIdentity}>{suggestion ? <AssistantMark size={24} /> : message ? <ColoredAvatar label={item.senderName} seed={item.senderName} size={24} /> : <View style={[styles.attentionIcon, { backgroundColor: urgent ? theme.dangerSoft : theme.backgroundElement }]}><PlatformIcon color={urgent ? theme.danger : theme.textSecondary} name="check-circle" size={14} /></View>}<ThemedText numberOfLines={1} style={styles.flex} themeColor="textSecondary" type="captionBold">{identity}</ThemedText></View>
      <ThemedText themeColor={urgent ? 'danger' : 'textTertiary'} type="caption">{relativeAttentionTime(item.createdAt)}</ThemedText>
    </View>
    {message ? <ThemedText numberOfLines={3} type="caption">{item.preview}</ThemedText> : <><ThemedText numberOfLines={2} type="title">{attentionTitle(item)}</ThemedText>{suggestion || item.kind === 'invitation' ? <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.preview}</ThemedText> : null}</>}
    <View style={[styles.attentionFooter, largeText && styles.attentionFooterLarge]}><ThemedText style={styles.flex} themeColor="textTertiary" type="caption">{attentionAction(item)}</ThemedText><View style={[styles.inlineAction, { backgroundColor: suggestion ? theme.accent : theme.backgroundElement }]}><ThemedText style={suggestion ? styles.actionInk : { color: theme.text }} type="captionBold">{actionLabel}</ThemedText></View></View>
    </Pressable>
  </View>;
}

function SectionHeading({ title }: { title: string }) {
  return <View style={styles.sectionHeading}><ThemedText style={styles.sectionTitle} themeColor="textSecondary" type="captionBold">{title}</ThemedText></View>;
}

const styles = StyleSheet.create({
  accountButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget }, actionInk: { color: '#1b1917' }, attentionCard: { gap: Spacing.two, padding: Spacing.three }, attentionFooter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' }, attentionFooterLarge: { alignItems: 'flex-start', flexDirection: 'column' }, attentionIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 24, justifyContent: 'center', width: 24 }, attentionIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two, minWidth: 0 }, attentionSection: { gap: Spacing.two }, attentionSurface: { borderCurve: 'continuous', borderLeftWidth: 3, borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }, attentionTopline: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  backLink: { alignItems: 'center', flexDirection: 'row', minHeight: TouchTarget }, clearState: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, minHeight: 52, padding: Spacing.three }, company: { textTransform: 'uppercase' }, companyLine: { alignItems: 'center', flexDirection: 'row', gap: 6 }, flex: { flex: 1, minWidth: 0 },
  hero: { gap: Spacing.one }, heroTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, heroToplineLarge: { alignItems: 'flex-start', flexDirection: 'column' },
  hub: { gap: Spacing.two }, hubIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 40, justifyContent: 'center', width: 40 }, hubRow: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexDirection: 'row', gap: Spacing.three, minHeight: 76, overflow: 'hidden', padding: Spacing.four }, inlineAction: { borderRadius: Radius.small, minHeight: 30, paddingHorizontal: Spacing.two, paddingVertical: 7 },
  metric: { borderCurve: 'continuous', borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: 1, gap: 2, minWidth: 0, padding: Spacing.three }, metricLabel: { fontSize: 10, lineHeight: 14, textTransform: 'uppercase' }, metricResult: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, metrics: { flexDirection: 'row', gap: Spacing.three }, metricsLarge: { flexDirection: 'column' }, metricValue: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 22 }, sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.three, marginTop: Spacing.two }, sectionTitle: { letterSpacing: 1, textTransform: 'uppercase' }, statusDot: { borderRadius: Radius.pill, height: 6, width: 6 }, statusLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
});
