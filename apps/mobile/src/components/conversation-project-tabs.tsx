import { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlatformIcon } from '@/components/platform-icon';
import { CompactPillButton } from '@/components/compact-pill-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';

export type ConversationProjectTab = {
  id: string;
  name: string;
};

/** Compact, scrollable Project tabs keep the selected scope visible and unclipped. */
export function ConversationProjectTabs({ projects, selectedId, onSelect, onOpen }: {
  projects: ConversationProjectTab[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen?: (id: string) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tabListRef = useRef<FlatList<ConversationProjectTab>>(null);
  const tabs = [{ id: '', name: 'All Projects' }, ...projects];
  const selectedProject = projects.find((project) => project.id === selectedId);
  const selectedIndex = selectedProject ? projects.findIndex((project) => project.id === selectedProject.id) + 1 : 0;
  const maxTabWidth = Math.max(132, Math.min(248, width - Spacing.six));

  useEffect(() => {
    if (selectedIndex <= 0) return;
    const frame = requestAnimationFrame(() => tabListRef.current?.scrollToIndex({ index: selectedIndex, animated: false, viewPosition: 0.5 }));
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);

  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <ThemedText themeColor="textSecondary" type="captionBold">Projects</ThemedText>
      {selectedProject && onOpen ? <Pressable
        accessibilityLabel={`Open ${selectedProject.name} Project`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => { hapticLight(); onOpen(selectedProject.id); }}
        style={({ pressed }) => [styles.openProject, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}
      >
        <ThemedText themeColor="accentStrong" type="captionBold">Open Project</ThemedText>
        <PlatformIcon color={theme.accentStrong} name="chevron-right" size={16} weight="regular" />
      </Pressable> : null}
    </View>

    <FlatList
      accessibilityLabel="Project scope"
      accessibilityRole="tablist"
      contentContainerStyle={styles.tabs}
      data={tabs}
      horizontal
      keyExtractor={(item) => item.id || 'all-projects'}
      onScrollToIndexFailed={({ averageItemLength, index }) => {
        requestAnimationFrame(() => tabListRef.current?.scrollToOffset({ offset: Math.max(1, averageItemLength || maxTabWidth / 2) * index, animated: false }));
      }}
      ref={tabListRef}
      renderItem={({ item }) => {
        const selected = (selectedId ?? '') === item.id;
        return <CompactPillButton
          accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          onPress={() => { hapticLight(); onSelect(item.id || null); }}
          targetStyle={{ maxWidth: maxTabWidth }}
          pillStyle={{
            backgroundColor: selected ? theme.accentSoft : theme.homeSurface,
            borderColor: selected ? theme.accentStrong : theme.homeBorder,
            flexShrink: 0,
            maxWidth: maxTabWidth,
          }}
          pressedPillStyle={{ backgroundColor: theme.backgroundSelected }}
        >
          <PlatformIcon color={selected ? theme.accentStrong : theme.textSecondary} name={item.id ? 'project' : 'office-building'} size={15} weight="regular" />
          <ThemedText numberOfLines={1} style={styles.tabLabel} type={selected ? 'captionBold' : 'caption'}>{item.name}</ThemedText>
          {selected ? <PlatformIcon color={theme.accentStrong} name="check" size={14} weight="semibold" /> : null}
        </CompactPillButton>;
      }}
      showsHorizontalScrollIndicator={false}
    />

  </View>;
}

const styles = StyleSheet.create({
  openProject: { alignItems: 'center', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  section: { gap: Spacing.one },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 },
  tabLabel: { flexShrink: 1, minWidth: 0 },
  tabs: { alignItems: 'center', gap: Spacing.two, paddingRight: Spacing.four },
});
