import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ProjectAccountButton } from '@/components/project-overview-dashboard';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { HomeFilter } from '@/lib/home-feed';
import { getHomeGreeting } from '@/lib/home-greeting';
import { attentionAction, attentionContext, attentionTitle, relativeAttentionTime, type MobileAttentionItem } from '@/lib/mobile-attention';
import { taskDueDisplay, taskPriorityLabel } from '@/lib/task-presentation';

export type { HomeFilter } from '@/lib/home-feed';
export type HomeTask = {
  companyName?: string;
  project: { name: string };
  state?: { category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'; name: string } | null;
  task: { description?: string; dueDate?: string; priority: 'none' | 'urgent' | 'high' | 'medium' | 'low'; publicKey: string; title: string };
};

export function HomeGreeting({ companyLabel, displayName, onProfile }: { companyLabel: string; displayName: string; onProfile?: () => void }) {
  const theme = useTheme();
  const now = new Date();
  const greeting = getHomeGreeting(now);
  const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', weekday: 'long' }).format(now).toUpperCase();
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  return <View style={styles.greetingRow}>
    <View style={styles.greetingIdentity}>
      <ColoredAvatar label={displayName} seed={displayName} shape="rounded" size={44} />
      <View style={styles.greetingCopy}>
        <View style={styles.contextLine}>
          <ThemedText numberOfLines={1} style={styles.eyebrow} themeColor="textSecondary" type="captionBold">{date}</ThemedText>
          <View style={[styles.contextDot, { backgroundColor: theme.hairline }]} />
          <ThemedText numberOfLines={1} style={styles.companyLabel} themeColor="accentStrong" type="captionBold">{companyLabel}</ThemedText>
        </View>
        <ThemedText adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={styles.greetingTitle} type="titleLarge">{greeting}, {firstName}</ThemedText>
      </View>
    </View>
    {onProfile ? <ProjectAccountButton label={displayName} onPress={onProfile} seed={displayName} /> : null}
  </View>;
}

export function HomePulse(props: { attentionCount: number; companyCount: number; dueTodayCount: number; mentionCount: number; openTaskCount: number; projectCount: number }) {
  const theme = useTheme();
  return <View style={[styles.pulse, { backgroundColor: theme.backgroundElevated }]}> 
    <View style={styles.pulseHeading}>
      <View style={styles.pulseCopy}>
        <ThemedText type="titleLarge">Today&apos;s Pulse</ThemedText>
        <ThemedText themeColor="textSecondary" type="caption">Across {props.projectCount} {props.projectCount === 1 ? 'Project' : 'Projects'}</ThemedText>
      </View>
      <View style={styles.scope}><PlatformIcon color={theme.textTertiary} name="office-building" size={14} /><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{props.companyCount} {props.companyCount === 1 ? 'Company' : 'Companies'}</ThemedText></View>
    </View>
    <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
    <View style={styles.metrics}>
      <Metric accent caption={`${props.mentionCount} direct ${props.mentionCount === 1 ? 'mention' : 'mentions'}`} icon="alert-circle" label="Needs attention" value={props.attentionCount} />
      <View style={[styles.metricDivider, { backgroundColor: theme.hairline }]} />
      <Metric caption={`${props.dueTodayCount} due today`} icon="check-circle" label="Open tasks" value={props.openTaskCount} />
    </View>
  </View>;
}

function Metric({ accent, caption, icon, label, value }: { accent?: boolean; caption: string; icon: IconName; label: string; value: number }) {
  const theme = useTheme();
  return <View style={styles.metric}>
    <View style={styles.metricLabel}><View style={[styles.metricIcon, { backgroundColor: accent ? theme.accentSoft : theme.backgroundElement }]}><PlatformIcon color={accent ? theme.accentStrong : theme.textSecondary} name={icon} size={16} /></View><ThemedText themeColor="textSecondary" type="caption">{label}</ThemedText></View>
    <ThemedText style={styles.metricValue}>{value}</ThemedText>
    <ThemedText themeColor="textSecondary" type="caption">{caption}</ThemedText>
  </View>;
}

export function HomeFilterChips({ filters, onChange, selected }: { filters: Array<{ key: HomeFilter; label: string; count: number }>; onChange: (value: HomeFilter) => void; selected: HomeFilter }) {
  const theme = useTheme();
  return <View style={[styles.filterRail, { backgroundColor: theme.backgroundElevated }]}><ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>{filters.map((item) => {
    const active = selected === item.key;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} hitSlop={4} key={item.key} onPress={() => onChange(item.key)} style={({ pressed }) => [styles.chip, { backgroundColor: active ? theme.accentSoft : 'transparent', opacity: pressed ? 0.72 : 1 }]}> 
      <ThemedText themeColor={active ? 'accentStrong' : 'textSecondary'} type={active ? 'captionBold' : 'caption'}>{item.label}</ThemedText>
      {item.key !== 'all' && item.count > 0 ? <ThemedText style={styles.filterCount} themeColor={active ? 'accentStrong' : 'textTertiary'} type="captionBold">{item.count}</ThemedText> : null}
    </Pressable>;
  })}</ScrollView></View>;
}

export function HomeSectionHeading({ icon, meta, title }: { icon: IconName; meta: string; title: string }) {
  const theme = useTheme();
  return <View accessibilityRole="header" style={styles.sectionHeading}><View style={styles.inline}><PlatformIcon color={theme.accentStrong} name={icon} size={17} /><ThemedText style={styles.sectionTitle} type="title">{title}</ThemedText></View><ThemedText themeColor="textTertiary" type="captionBold">{meta}</ThemedText></View>;
}

export function HomeAttentionCard({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const task = item.kind === 'task';
  const suggestion = item.kind === 'suggestion';
  const urgent = task && (item.eventType === 'overdue' || item.eventType === 'due_soon');
  const direct = item.eventType === 'mention' || item.eventType === 'direct_reply';
  const icon: IconName = task ? 'task' : suggestion ? 'lightbulb-outline' : item.kind === 'message' ? 'message' : 'account-group';
  const label = task ? item.taskKey : suggestion ? 'TRACK SUGGESTION' : item.kind === 'message' ? `#${item.groupName}` : 'INVITATION';
  const title = item.kind === 'message' ? `${attentionTitle(item)}: \u201c${item.preview}\u201d` : suggestion ? `Suggested task: \u201c${item.title}\u201d` : attentionTitle(item);
  const action = task ? 'Review Task' : suggestion ? 'Review & Create' : item.kind === 'message' ? (item.threadId ? 'Jump to thread' : 'Open Channel') : attentionAction(item);
  const reason = attentionAction(item);
  return <Pressable accessibilityLabel={`${title}. ${attentionContext(item)}. ${reason}. ${action}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.attentionCard, { backgroundColor: pressed ? theme.backgroundElement : theme.backgroundElevated, borderColor: theme.hairline }]}>
    <View style={styles.between}><View style={styles.cardContext}><View style={[styles.attentionIcon, { backgroundColor: urgent ? theme.dangerSoft : direct || suggestion ? theme.accentSoft : theme.backgroundElement }]}><PlatformIcon color={urgent ? theme.danger : direct || suggestion ? theme.accentStrong : theme.textSecondary} name={icon} size={15} /></View><ThemedText numberOfLines={1} style={styles.identifier} themeColor="textSecondary" type="captionBold">{label}</ThemedText><ThemedText numberOfLines={1} style={styles.contextText} themeColor="textSecondary" type="caption">{attentionContext(item)}</ThemedText></View><ThemedText themeColor={urgent ? 'danger' : 'textTertiary'} type="caption">{relativeAttentionTime(item.createdAt)}</ThemedText></View>
    <ThemedText numberOfLines={2} style={styles.cardTitle} type={task ? 'title' : 'label'}>{title}</ThemedText>
    <View style={styles.cardFooter}>{!suggestion && item.kind !== 'invitation' ? <ThemedText numberOfLines={1} style={styles.footerReason} themeColor="textTertiary" type="caption">{reason}</ThemedText> : <View style={styles.footerReason} />}<View style={[styles.cardAction, { backgroundColor: suggestion ? theme.text : 'transparent' }]}>{suggestion ? <PlatformIcon color={theme.background} name="check-circle" size={14} /> : null}<ThemedText style={{ color: suggestion ? theme.background : theme.accentStrong }} type="captionBold">{action}</ThemedText>{!suggestion ? <PlatformIcon color={theme.accentStrong} name="chevron-right" size={12} /> : null}</View></View>
  </Pressable>;
}

export function HomeTaskCard({ assigneeName, item, onPress }: { assigneeName: string; item: HomeTask; onPress: () => void }) {
  const theme = useTheme();
  const due = taskDueDisplay(item.task.dueDate, undefined, item.state?.category)?.label;
  const state = item.state?.name ?? 'Open';
  const priority = item.task.priority !== 'none' ? taskPriorityLabel(item.task.priority) : null;
  const urgent = item.task.priority === 'urgent' || item.task.priority === 'high';
  const taskContext = [item.companyName, item.project.name].filter(Boolean).join(' · ');
  return <Pressable accessibilityLabel={`${item.task.title}. ${item.task.publicKey}. ${state}. ${priority ?? 'No priority'}. ${taskContext}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.taskCard, { backgroundColor: pressed ? theme.backgroundElement : theme.backgroundElevated, borderColor: theme.hairline }]}>
    <View style={styles.between}><ThemedText numberOfLines={1} style={styles.taskMeta} themeColor="textSecondary" type="captionBold">{item.task.publicKey} · {state}{priority ? ` · ${priority}` : ''}</ThemedText>{due ? <ThemedText themeColor={urgent ? 'danger' : 'textSecondary'} type="caption">{due}</ThemedText> : null}</View>
    <View><ThemedText numberOfLines={2} style={styles.taskTitle} type="title">{item.task.title}</ThemedText>{item.task.description ? <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.task.description}</ThemedText> : null}</View>
    <View style={styles.between}><View style={styles.taskContext}><PlatformIcon color={theme.textTertiary} name="project" size={13} /><ThemedText numberOfLines={1} style={styles.contextText} themeColor="textTertiary" type="caption">{[item.companyName, item.project.name].filter(Boolean).join(' \u00b7 ')}</ThemedText></View><ColoredAvatar label={assigneeName} seed={assigneeName} size={20} /></View>
  </Pressable>;
}

export function HomeQuickAction({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel="Create a new task" accessibilityRole="button" android_ripple={{ color: theme.accentSoft }} onPress={onPress} style={({ pressed }) => [styles.quick, { backgroundColor: pressed ? theme.accentSoft : theme.backgroundElement, borderColor: theme.hairline }]}><View style={styles.quickCopy}><View style={[styles.quickIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="plus" size={18} /></View><View style={styles.quickText}><ThemedText type="label">New task</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">Capture work in the right Project</ThemedText></View></View><PlatformIcon color={theme.accentStrong} name="chevron-right" size={16} /></Pressable>;
}

const styles = StyleSheet.create({
  attentionCard: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 2px 8px rgba(0,0,0,0.045)', gap: Spacing.two, minHeight: 116, overflow: 'hidden', padding: Spacing.four },
  attentionIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 28, justifyContent: 'center', width: 28 },
  between: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  cardAction: { alignItems: 'center', borderRadius: 4, flexDirection: 'row', gap: Spacing.one, minHeight: 30, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  cardContext: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.one, minWidth: 0, paddingRight: Spacing.two },
  cardFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.two }, cardTitle: { lineHeight: 20 }, footerReason: { flex: 1, minWidth: 0 },
  chip: { alignItems: 'center', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.one, minHeight: 40, paddingHorizontal: Spacing.three },
  companyLabel: { flexShrink: 1 }, contextDot: { borderRadius: Radius.pill, height: 4, width: 4 }, contextLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minWidth: 0 }, contextText: { flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth }, eyebrow: { fontSize: 10.5, letterSpacing: 0.55, lineHeight: 14 }, filterCount: { fontVariant: ['tabular-nums'] }, filterRail: { borderCurve: 'continuous', borderRadius: Radius.medium, overflow: 'hidden' }, filters: { gap: 2, padding: Spacing.one },
  greetingCopy: { flex: 1, minWidth: 0 }, greetingIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.three, minWidth: 0 }, greetingRow: { alignItems: 'center', flexDirection: 'row', minHeight: 48 }, greetingTitle: { fontSize: 22, lineHeight: 28 },
  identifier: { flexShrink: 1 }, inline: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  metric: { flex: 1, gap: Spacing.one, minWidth: 0, paddingVertical: Spacing.two }, metricDivider: { width: StyleSheet.hairlineWidth }, metricIcon: { alignItems: 'center', borderRadius: Radius.small, height: 28, justifyContent: 'center', width: 28 }, metricLabel: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, metrics: { flexDirection: 'row', gap: Spacing.four, paddingTop: Spacing.two }, metricValue: { fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 34 },
  pulse: { borderCurve: 'continuous', borderRadius: Radius.large, boxShadow: '0 2px 10px rgba(0,0,0,0.045)', gap: Spacing.three, padding: Spacing.four }, pulseCopy: { flex: 1, gap: 2 }, pulseHeading: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, justifyContent: 'space-between' },
  quick: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, padding: Spacing.three }, quickCopy: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.three, minWidth: 0 }, quickIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 40, justifyContent: 'center', width: 40 }, quickText: { flex: 1, minWidth: 0 },
  scope: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, maxWidth: 112 }, sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 22 }, sectionTitle: { fontSize: 16, lineHeight: 22 },
  taskCard: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 2px 8px rgba(0,0,0,0.045)', gap: Spacing.three, minHeight: 126, overflow: 'hidden', padding: Spacing.four }, taskContext: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.one, minWidth: 0 }, taskMeta: { flex: 1, minWidth: 0 }, taskTitle: { fontSize: 16, lineHeight: 22 }, flex: { flex: 1 },
});
