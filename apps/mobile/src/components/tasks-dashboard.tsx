import { Pressable, StyleSheet, View } from 'react-native';
import { AssistantMark } from '@/components/chat/assistant-mark';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TaskViewMode = 'board' | 'list';

export function TasksToolbar({ boardName, filterActive, mode, onBoardPress, onFilterPress, onModeChange, onSearchPress, onSuggestionsPress, projectName, searchActive, suggestionCount }: {
  boardName: string; filterActive: boolean; mode: TaskViewMode; onBoardPress: () => void; onFilterPress: () => void; onModeChange: (mode: TaskViewMode) => void; onSearchPress: () => void; onSuggestionsPress: () => void; projectName: string; searchActive: boolean; suggestionCount: number;
}) {
  const theme = useTheme();
  return <View style={styles.toolbar}>
    <View style={styles.toolbarLine}>
      <Pressable accessibilityLabel={`Board: ${boardName}. Project: ${projectName}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onBoardPress} style={[styles.boardSelector, { backgroundColor: theme.backgroundElement }]}>
        <PlatformIcon color={theme.accentStrong} name="view-board" size={17} />
        <View style={styles.boardCopy}><ThemedText numberOfLines={1} style={styles.boardEyebrow} themeColor="textSecondary" type="captionBold">{boardName}</ThemedText><ThemedText numberOfLines={1} type="smallBold">{projectName}</ThemedText></View>
        <PlatformIcon color={theme.textTertiary} name="chevron-down" size={15} />
      </Pressable>
      <View style={styles.toolbarActions}><ToolbarIcon active={searchActive} icon="search" label="Search tasks" onPress={onSearchPress} /><ToolbarIcon active={filterActive} icon="filter" label="Filter and sort tasks" onPress={onFilterPress} /></View>
    </View>
    <View style={styles.toolbarLine}>
      <View accessibilityRole="tablist" style={[styles.viewSwitch, { backgroundColor: theme.backgroundSelected }]}><ViewToggle icon="view-board" label="Board" mode="board" onPress={onModeChange} selected={mode === 'board'} /><ViewToggle icon="list" label="List" mode="list" onPress={onModeChange} selected={mode === 'list'} /></View>
      <Pressable accessibilityLabel={suggestionCount ? `${suggestionCount} task ${suggestionCount === 1 ? 'suggestion' : 'suggestions'}` : 'Task suggestion inbox'} accessibilityRole="button" android_ripple={{ color: theme.accentSoft }} onPress={onSuggestionsPress} style={[styles.suggestionPill, { backgroundColor: theme.accentSoft }]}>
        <PlatformIcon color={theme.accentStrong} name="lightbulb-outline" size={16} /><ThemedText themeColor="accentStrong" type="captionBold">{suggestionCount ? `${suggestionCount} ${suggestionCount === 1 ? 'suggestion' : 'suggestions'}` : 'Inbox'}</ThemedText>
      </Pressable>
    </View>
  </View>;
}

function ToolbarIcon({ active, icon, label, onPress }: { active: boolean; icon: 'filter' | 'search'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: active }} android_ripple={{ color: theme.backgroundSelected, borderless: true }} onPress={onPress} style={[styles.toolbarIcon, { backgroundColor: active ? theme.accentSoft : theme.backgroundElement }]}><PlatformIcon color={active ? theme.accentStrong : theme.textSecondary} name={icon} size={18} /></Pressable>;
}

function ViewToggle({ icon, label, mode, onPress, selected }: { icon: 'list' | 'view-board'; label: string; mode: TaskViewMode; onPress: (mode: TaskViewMode) => void; selected: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onPress(mode)} style={[styles.viewToggle, selected && { backgroundColor: theme.backgroundElevated }]}><PlatformIcon color={selected ? theme.text : theme.textSecondary} name={icon} size={15} /><ThemedText themeColor={selected ? 'text' : 'textSecondary'} type="captionBold">{label}</ThemedText></Pressable>;
}

export function TaskSuggestionBanner({ channelName, onDismiss, onReview, title }: { channelName?: string; onDismiss?: () => void; onReview: () => void; title: string }) {
  const theme = useTheme();
  return <View style={[styles.suggestionBanner, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
    <View style={[styles.suggestionRail, { backgroundColor: theme.accentStrong }]} /><AssistantMark size={30} />
    <View style={styles.suggestionBody}>
      <View style={styles.suggestionMeta}><ThemedText themeColor="accentStrong" type="captionBold">Automated capture</ThemedText>{channelName ? <ThemedText themeColor="textTertiary" type="caption">from #{channelName}</ThemedText> : null}</View>
      <ThemedText numberOfLines={2} type="small">“{title}”</ThemedText>
      <View style={styles.suggestionActions}><Pressable accessibilityRole="button" onPress={onReview} style={[styles.reviewButton, { backgroundColor: theme.text }]}><ThemedText style={{ color: theme.background }} type="captionBold">Review &amp; Accept</ThemedText></Pressable>{onDismiss ? <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissButton}><ThemedText themeColor="textSecondary" type="captionBold">Dismiss</ThemedText></Pressable> : null}</View>
    </View>
  </View>;
}

export function SprintFlowHeader({ columnCount, taskCount }: { columnCount: number; taskCount: number }) {
  const theme = useTheme();
  const visibleDots = Math.max(1, Math.min(columnCount, 5));
  return <View style={styles.flowHeader}><View style={styles.flowCopy}><ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">Sprint flow</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</ThemedText></View><View style={styles.flowDots}>{Array.from({ length: visibleDots }, (_, index) => <View key={index} style={[styles.flowDot, index === 0 && styles.flowDotActive, { backgroundColor: index === 0 ? theme.text : theme.hairline }]} />)}</View></View>;
}

export function TaskCreateContext({ boardName, projectName }: { boardName?: string; projectName: string }) {
  const theme = useTheme();
  return <View style={styles.createContext}><ThemedText themeColor="accentStrong" type="captionBold">{projectName}</ThemedText><View style={[styles.evidenceNote, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.accentStrong} name="message" size={18} /><View style={styles.boardCopy}><ThemedText themeColor="textSecondary" type="caption">Evidence-aware task</ThemedText><ThemedText numberOfLines={2} type="small">Conversation references stay attached when this task comes from a Channel.</ThemedText></View></View>{boardName ? <ThemedText themeColor="textTertiary" type="caption">Creating in {boardName}</ThemedText> : null}</View>;
}

const styles = StyleSheet.create({
  boardCopy: { flex: 1, minWidth: 0 },
  boardEyebrow: { fontSize: 9.5, lineHeight: 12, textTransform: 'uppercase' },
  boardSelector: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, flex: 1, flexDirection: 'row', gap: Spacing.two, maxWidth: 250, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  createContext: { gap: Spacing.two },
  dismissButton: { alignItems: 'center', justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  evidenceNote: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, minHeight: 58, padding: Spacing.three },
  flowCopy: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  flowDot: { borderRadius: Radius.pill, height: 6, width: 8 },
  flowDotActive: { width: 24 },
  flowDots: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  flowHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 30 },
  reviewButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  suggestionActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingTop: Spacing.one },
  suggestionBanner: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, overflow: 'hidden', padding: Spacing.three },
  suggestionBody: { flex: 1, gap: Spacing.one, minWidth: 0 },
  suggestionMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  suggestionPill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  suggestionRail: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  toolbar: { gap: Spacing.two },
  toolbarActions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  toolbarIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, height: TouchTarget, justifyContent: 'center', overflow: 'hidden', width: TouchTarget },
  toolbarLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  viewSwitch: { borderCurve: 'continuous', borderRadius: Radius.pill, flexDirection: 'row', padding: 2 },
  viewToggle: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
});
