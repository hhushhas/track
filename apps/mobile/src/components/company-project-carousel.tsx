import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useState } from 'react';

import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import type { HomeProject } from '@/components/home-workspace-types';
import { IconSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeOverride } from '@/contexts/theme-override-context';

export function ProjectsSection({
  onChannel,
  onOpen,
  onSeeAll,
  projects,
}: {
  onChannel: (project: HomeProject, channel: NonNullable<HomeProject['channels']>[number]) => void;
  onOpen: (project: HomeProject) => void;
  onSeeAll: () => void;
  projects: HomeProject[];
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, width - Spacing.four * 2);
  const [expandedProjectId, setExpandedProjectId] = useState<HomeProject['id'] | null>(null);

  return (
    <View style={styles.section}>
      <SectionHeader label="Projects" onPress={onSeeAll} />
      {projects.length ? (
        <ScrollView
          accessibilityLabel="Company Projects"
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + Spacing.three}
          snapToAlignment="start">
          {projects.map((project) => (
            <ProjectWorkspaceCard
              key={project.id}
              onChannel={(channel) => onChannel(project, channel)}
              onOpen={() => onOpen(project)}
              expanded={expandedProjectId === project.id}
              onToggleChannels={() => setExpandedProjectId((current) => current === project.id ? null : project.id)}
              project={project}
              width={cardWidth}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptySurface copy="No Projects are available in this Company." />
      )}
    </View>
  );
}

function ProjectWorkspaceCard({
  onChannel,
  onOpen,
  expanded,
  onToggleChannels,
  project,
  width,
}: {
  onChannel: (channel: NonNullable<HomeProject['channels']>[number]) => void;
  onOpen: () => void;
  expanded: boolean;
  onToggleChannels: () => void;
  project: HomeProject;
  width: number;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const members = project.members ?? [];
  const channels = project.channels ?? [];
  const remainingMembers = Math.max(0, project.memberCount - members.length);
  const remainingChannels = Math.max(0, (project.channelCount ?? channels.length) - channels.length);
  const role = project.role === 'owner' ? 'Leader' : project.role === 'manager' ? 'Manager' : project.health;

  return (
    <View style={[styles.card, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder, width }]}>
      <Pressable accessibilityLabel={`${project.name}. ${role}. Open Project.`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.primaryArea, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
      <ProjectCardArtwork />
      <View style={styles.cardTop}>
        <View style={[styles.projectMark, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name="project" size={IconSize.large} weight="semibold" />
        </View>
      </View>

      <View style={styles.projectCopy}>
        <ThemedText numberOfLines={1} style={styles.projectName} type="titleLarge">{project.name}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="accentStrong" type="label">{role}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
          {project.companyName ?? 'Company'} · {project.totalTasks ?? 0} tasks · {project.channelCount ?? channels.length} Channels
        </ThemedText>
      </View>
      </Pressable>

      <View style={styles.detailsRow}>
        <View accessibilityLabel={`${project.memberCount} Project members`} style={styles.avatars}>
          {members.map((member, index) => (
            <View key={member.id} style={[styles.avatarWrap, index > 0 && styles.avatarOverlap, { borderColor: theme.homeSurface }]}>
              {member.avatarUrl ? (
                <Image accessibilityLabel={member.name} contentFit="cover" recyclingKey={String(member.id)} source={{ uri: member.avatarUrl }} style={styles.memberImage} transition={120} />
              ) : <ColoredAvatar label={member.name} seed={member.id} size={30} />}
            </View>
          ))}
          {remainingMembers > 0 ? (
            <View style={[styles.remaining, styles.avatarOverlap, { backgroundColor: theme.backgroundElement, borderColor: theme.homeSurface }]}>
              <ThemedText type="captionBold">+{remainingMembers}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <Pressable
            accessibilityLabel={`Open ${project.name} Project`}
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            style={({ pressed }) => [styles.openProject, { borderColor: theme.homeBorder, opacity: pressed ? 0.65 : 1 }]}>
            <ThemedText themeColor="text" type="captionBold">Open Project</ThemedText>
            <PlatformIcon color={theme.text} name="chevron-right" size={IconSize.small} />
          </Pressable>
          <Pressable
            accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${project.name} Channels`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            hitSlop={4}
            onPress={(event) => {
              event.stopPropagation();
              onToggleChannels();
            }}
            style={({ pressed }) => [styles.arrow, { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 }]}>
            <PlatformIcon color={theme.homeBackground} name={expanded ? 'chevron-down' : 'chevron-right'} size={IconSize.large} weight="semibold" />
          </Pressable>
        </View>
      </View>

      {expanded ? <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(180)}
        exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        layout={reduceMotion ? undefined : LinearTransition.duration(180)}
        style={[styles.channelDrawer, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
        <View style={styles.channelDrawerHeading}>
          <View style={styles.channelDrawerTitle}>
            <PlatformIcon color={theme.accentStrong} name="channel" size={IconSize.small} />
            <ThemedText type="captionBold">Channels</ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" type="caption">{channels.length + remainingChannels}</ThemedText>
        </View>
        <View style={styles.channelList}>
          {channels.map((channel) => (
            <Pressable
              accessibilityLabel={`Open ${channel.name} Channel`}
              accessibilityRole="button"
              key={channel.id}
              onPress={(event) => {
                event.stopPropagation();
                onChannel(channel);
              }}
              style={({ pressed }) => [styles.channel, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder, opacity: pressed ? 0.65 : 1 }]}>
              <PlatformIcon color={theme.textSecondary} name="channel" size={IconSize.small} />
              <ThemedText numberOfLines={1} style={styles.channelLabel} type="captionBold">#{channel.name.replace(/^#/, '')}</ThemedText>
              <PlatformIcon color={theme.textTertiary} name="chevron-right" size={IconSize.small} />
            </Pressable>
          ))}
          {remainingChannels > 0 ? <ThemedText themeColor="textSecondary" type="caption">+{remainingChannels} more Channels are available in the Project.</ThemedText> : null}
          {!channels.length ? <ThemedText themeColor="textSecondary" type="caption">No Channels are available yet.</ThemedText> : null}
        </View>
      </Animated.View> : null}
    </View>
  );
}

function ProjectCardArtwork() {
  const { theme: themeName } = useThemeOverride();
  return (
    <Image
      accessibilityElementsHidden
      cachePolicy="memory-disk"
      contentFit="cover"
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      source={themeName === 'dark'
        ? require('../../assets/images/project-card-art.webp')
        : require('../../assets/images/project-card-art-light.webp')}
      style={[styles.artImage, { opacity: themeName === 'dark' ? 0.72 : 0.56 }]}
    />
  );
}

export function SectionHeader({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <ThemedText type="titleLarge">{label}</ThemedText>
      <Pressable accessibilityLabel={`See all ${label}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.seeAll, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText themeColor="textSecondary" type="label">See all</ThemedText>
        <PlatformIcon color={theme.textSecondary} name="chevron-right" size={IconSize.small} />
      </Pressable>
    </View>
  );
}

export function EmptySurface({ copy }: { copy: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
      <ThemedText themeColor="textSecondary" type="label">{copy}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { alignItems: 'center', borderRadius: Radius.pill, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  artImage: StyleSheet.absoluteFillObject,
  avatarOverlap: { marginLeft: -8 },
  avatars: { alignItems: 'center', flexDirection: 'row', minHeight: 32 },
  avatarWrap: { borderRadius: Radius.pill, borderWidth: 2 },
  card: {
    borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two,
    minHeight: 204, overflow: 'hidden', padding: Spacing.three,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardActions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  carouselContent: { gap: Spacing.three, paddingRight: Spacing.four },
  channel: { alignItems: 'center', borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: 42, paddingHorizontal: Spacing.two },
  channelDrawer: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.two },
  channelDrawerHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  channelDrawerTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  channelLabel: { flex: 1 },
  channelList: { gap: Spacing.one },
  detailsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  empty: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  memberImage: { borderRadius: Radius.pill, height: 30, width: 30 },
  openProject: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  primaryArea: { borderRadius: Radius.medium, gap: Spacing.two, overflow: 'hidden', padding: Spacing.one },
  projectCopy: { gap: 2 },
  projectMark: { alignItems: 'center', borderRadius: Radius.medium, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  projectName: { fontSize: 19, lineHeight: 24 },
  remaining: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 2, height: 32, justifyContent: 'center', width: 32 },
  section: { gap: Spacing.three },
  seeAll: { alignItems: 'center', flexDirection: 'row', minHeight: TouchTarget, paddingLeft: Spacing.three },
});
