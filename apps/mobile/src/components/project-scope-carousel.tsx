import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColoredAvatar } from '@/components/colored-avatar';
import { CompactPillButton } from '@/components/compact-pill-button';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';

export type ProjectScopeOption = {
  channelCount?: number;
  channelCountTruncated?: boolean;
  id: string;
  memberCount?: number;
  memberCountTruncated?: boolean;
  members?: Array<{ avatarUrl: string | null; id: string; name: string }>;
  name: string;
  role?: string;
};

export type ProjectScopeChannel = { id: string; name: string };

/** Project overview cards remain available to task surfaces that need team context. */
export function ProjectScopeCarousel({ projects, selectedId, onSelect, onOpen, expandedId, channels, onToggleChannels, onChannel, onLoadMoreChannels, channelsLoading, hasMoreChannels, allDescription = 'All Company conversations', allFooterLabel = 'Company-wide', presentation = 'overview' }: {
  projects: ProjectScopeOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen?: (id: string) => void;
  expandedId?: string | null;
  channels?: ProjectScopeChannel[];
  onToggleChannels?: (id: string) => void;
  onChannel?: (projectId: string, channelId: string) => void;
  onLoadMoreChannels?: () => void;
  channelsLoading?: boolean;
  hasMoreChannels?: boolean;
  allDescription?: string;
  allFooterLabel?: string;
  presentation?: 'overview' | 'compact';
}) {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(268, Math.max(220, width - insets.left - insets.right - Spacing.four * 3));
  const options: ProjectScopeOption[] = [{ id: '', memberCount: projects.length, name: 'All Projects' }, ...projects];

  return <View style={styles.section}>
    <ThemedText type="subtitle">Projects</ThemedText>
    <FlatList
      accessibilityLabel="Project scope"
      contentContainerStyle={styles.content}
      data={options}
      horizontal
      keyExtractor={(item) => item.id || 'all-projects'}
      renderItem={({ item }) => {
        const selected = (selectedId ?? '') === item.id;
        const memberCount = item.memberCountTruncated ? `${item.memberCount ?? 4}+` : String(item.memberCount ?? item.members?.length ?? 0);
        const channelCount = item.channelCountTruncated ? `${item.channelCount ?? 100}+` : String(item.channelCount ?? 0);
        if (presentation === 'compact') return <CompactPillButton
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
          key={item.id || 'all-projects'}
          onPress={() => { hapticLight(); onSelect(item.id || null); }}
          pillStyle={{ backgroundColor: selected ? theme.accentSoft : theme.homeSurface, borderColor: selected ? 'transparent' : theme.homeBorder, maxWidth: 260 }}
          pressedPillStyle={{ backgroundColor: theme.homeBackground, borderColor: 'transparent' }}
        >
          <PlatformIcon color={selected ? theme.accentStrong : theme.textSecondary} name={item.id ? 'project' : 'office-building'} size={15} />
          <ThemedText numberOfLines={1} style={[styles.compactLabel, { color: selected ? theme.accentStrong : theme.text }]} type="captionBold">{item.name}</ThemedText>
          {selected ? <PlatformIcon color={theme.accentStrong} name="check" size={14} /> : null}
        </CompactPillButton>;
        return <View style={[styles.card, { width: cardWidth, backgroundColor: theme.homeSurface, borderColor: selected ? theme.accentStrong : theme.homeBorder }]}>
          <Image
            accessibilityElementsHidden
            cachePolicy="memory-disk"
            contentFit="cover"
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            source={themeName === 'dark' ? require('../../assets/images/project-card-art.webp') : require('../../assets/images/project-card-art-light.webp')}
            style={[StyleSheet.absoluteFill, styles.artwork, { opacity: themeName === 'dark' ? 0.32 : 0.26 }]}
          />
          <Pressable
            accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => { hapticLight(); onSelect(item.id || null); }}
            style={({ pressed }) => [styles.cardMain, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}
          >
            <View style={styles.markWrap}>
              <View style={[styles.mark, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name={item.id ? 'project' : 'office-building'} size={18} /></View>
              {item.id ? <View style={[styles.channelCorner, { backgroundColor: theme.homeSurface, borderColor: theme.homeSurface }]}><PlatformIcon color={theme.accentStrong} name="channel" size={12} /></View> : null}
            </View>
            <View style={styles.projectCopy}>
              <ThemedText numberOfLines={1} style={styles.name} type="smallBold">{item.name}</ThemedText>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{item.id ? item.role ?? 'Project' : allDescription}</ThemedText>
            </View>
          </Pressable>
          <View style={styles.cardFooter}>
            {item.id ? <View accessibilityLabel={`${memberCount} Project members`} style={styles.teamPreview}>
              {item.members?.slice(0, 3).map((member, index) => <View key={member.id} style={[styles.avatarFrame, index > 0 && styles.avatarOverlap, { borderColor: theme.homeSurface }]}>
                {member.avatarUrl ? <Image accessibilityLabel={member.name} contentFit="cover" recyclingKey={member.id} source={{ uri: member.avatarUrl }} style={styles.avatar} transition={120} /> : <ColoredAvatar label={member.name} seed={member.id} size={22} />}
              </View>)}
              <View style={styles.counts}>
                <View style={styles.countLine}><PlatformIcon color={theme.textSecondary} name="person" size={12} /><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{memberCount} members</ThemedText></View>
                <View style={styles.countLine}><PlatformIcon color={theme.textSecondary} name="channel" size={12} /><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{channelCount} Channels</ThemedText></View>
              </View>
            </View> : <View accessibilityLabel={allDescription} style={styles.companyWide}><PlatformIcon color={theme.textSecondary} name="office-building" size={16} /><ThemedText themeColor="textSecondary" type="captionBold">{allFooterLabel}</ThemedText></View>}
            {item.id && onOpen ? <Pressable accessibilityLabel={`Open ${item.name} Project`} accessibilityRole="button" hitSlop={4} onPress={() => { hapticLight(); onOpen(item.id); }} style={({ pressed }) => [styles.openAction, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, borderColor: theme.homeBorder }]}>
              <ThemedText numberOfLines={1} type="captionBold">Open Project</ThemedText><PlatformIcon color={theme.textSecondary} name="chevron-right" size={14} />
            </Pressable> : null}
          </View>
          {item.id && onToggleChannels ? <>
            <Pressable accessibilityLabel={`${expandedId === item.id ? 'Hide' : 'Show'} ${item.name} Channels`} accessibilityRole="button" accessibilityState={{ expanded: expandedId === item.id }} onPress={() => onToggleChannels(item.id)} style={styles.channelToggle}>
              <PlatformIcon color={theme.accentStrong} name="channel" size={14} />
              <ThemedText themeColor="accentStrong" type="captionBold">{expandedId === item.id ? 'Hide Channels' : `View ${channelCount} Channels`}</ThemedText>
              <PlatformIcon color={theme.textSecondary} name={expandedId === item.id ? 'chevron-up' : 'chevron-down'} size={14} />
            </Pressable>
            {expandedId === item.id ? <View style={[styles.channelDrawer, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
              {channelsLoading ? <ThemedText themeColor="textSecondary" type="caption">Loading Channels…</ThemedText> : channels?.length ? channels.map((channel) => <Pressable accessibilityLabel={`Open ${channel.name} Channel`} accessibilityRole="button" key={channel.id} onPress={() => onChannel?.(item.id, channel.id)} style={({ pressed }) => [styles.channelRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
                <PlatformIcon color={theme.textSecondary} name="channel" size={14} /><ThemedText numberOfLines={1} style={styles.channelName} type="captionBold">#{channel.name.replace(/^#/, '')}</ThemedText><PlatformIcon color={theme.textTertiary} name="chevron-right" size={14} />
              </Pressable>) : <ThemedText themeColor="textSecondary" type="caption">No Channels are available in this Project yet.</ThemedText>}
              {hasMoreChannels && onLoadMoreChannels ? <Pressable accessibilityRole="button" disabled={channelsLoading} onPress={onLoadMoreChannels} style={styles.channelMore}><ThemedText themeColor="accentStrong" type="captionBold">{channelsLoading ? 'Loading Channels…' : 'Load more Channels'}</ThemedText></Pressable> : null}
            </View> : null}
          </> : null}
        </View>;
      }}
      showsHorizontalScrollIndicator={false}
    />
  </View>;
}

const styles = StyleSheet.create({
  artwork: { borderRadius: Radius.medium },
  avatar: { borderRadius: Radius.pill, height: 22, width: 22 },
  avatarFrame: { borderRadius: Radius.pill, borderWidth: 2 },
  avatarOverlap: { marginLeft: -7 },
  card: { borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, minHeight: 118, overflow: 'hidden', padding: Spacing.two },
  cardFooter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, justifyContent: 'space-between', minHeight: 46, paddingHorizontal: Spacing.one },
  cardMain: { alignItems: 'center', borderRadius: Radius.small, flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: 48, padding: Spacing.one },
  channelCorner: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1.5, bottom: -4, height: 19, justifyContent: 'center', position: 'absolute', right: -5, width: 19 },
  channelDrawer: { borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, gap: 1, marginTop: Spacing.one, paddingHorizontal: Spacing.one, paddingVertical: Spacing.half },
  channelMore: { justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  channelName: { flex: 1, minWidth: 0 },
  channelRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  channelToggle: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  countLine: { alignItems: 'center', flexDirection: 'row', gap: 3, minWidth: 0 },
  counts: { flex: 1, gap: 1, minWidth: 0 },
  mark: { alignItems: 'center', borderRadius: Radius.small, height: 34, justifyContent: 'center', width: 34 },
  markWrap: { height: 38, position: 'relative', width: 38 },
  name: { fontSize: 15, lineHeight: 20 },
  openAction: { alignItems: 'center', borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 2, minHeight: TouchTarget, paddingHorizontal: Spacing.one },
  projectCopy: { flex: 1, gap: 2, minWidth: 0 },
  section: { gap: Spacing.two },
  teamPreview: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  companyWide: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  compactLabel: { flexShrink: 1 },
  content: { alignItems: 'flex-start', gap: Spacing.two, paddingBottom: Spacing.one, paddingRight: Spacing.four },
});
