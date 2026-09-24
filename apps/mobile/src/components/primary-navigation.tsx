import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, IconSize, Radius, Spacing } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { primaryDestinationForRoute, primaryDestinationIndexAtX, primaryNavigationHeight, primaryNavigationVisibleForPath, primaryTabResetTarget, type PrimaryDestination } from '@/lib/primary-navigation';
import { useReleaseConfig } from '@/lib/release-config';
import { taskListHref } from '@/lib/task-navigation';
import type { Id } from '../../../../convex/_generated/dataModel';

type StandaloneTabKey = PrimaryDestination['key'];
type NavigationItem = { key: StandaloneTabKey; label: string; icon: IconName; href: string; disabled?: boolean };
type NavigationParams = { archive?: string; companyId?: string; groupId?: string; membershipId?: string; projectId?: string };

const standaloneTabs: NavigationItem[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/' },
  { key: 'inbox', label: 'Inbox', icon: 'email-outline', href: '/inbox' },
  { key: 'tasks', label: 'My Tasks', icon: 'task', href: '/tasks' },
  { key: 'team', label: 'Team', icon: 'account-group', href: '/team' },
];

/** Keeps utility routes attached to the same five-position app shell. */
export function StandalonePrimaryNavigation({ active, onCreate }: { active?: StandaloneTabKey; onCreate?: () => void }) {
  const router = useRouter();
  const release = useReleaseConfig();
  return <FloatingNavigation
    activeKey={active}
    createDisabled={!release.tasks}
    hidden={false}
    items={standaloneTabs}
    onCreate={onCreate ?? (() => router.navigate(`/today?create=${Date.now()}` as never))}
    onSelect={(item) => router.replace(item.href as never)}
  />;
}

/** Four peer destinations with a non-route creation action in the physical center. */
export function PrimaryNavigation({ navigation, state }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<NavigationParams>();
  const release = useReleaseConfig();
  const keyboardVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const { createContext, hidden, setHidden } = usePrimaryNavigationVisibility();
  // Projects remains reachable from Home, but it is not a peer destination in
  // the global action bar.
  const visibleRoutes = state.routes.filter((route) => route.name !== '(projects)');
  const items = visibleRoutes.map((route) => ({
    ...primaryDestinationForRoute(route.name, !release.tasks),
    href: route.name,
  }));
  const activeRouteName = state.routes[state.index]?.name;
  const activeKey = items.find((item) => item.href === activeRouteName)?.key ?? 'home';
  const scopedParams: NavigationParams = createContext
    ? { ...createContext, archive: createContext.archive ? '1' : undefined }
    : params;
  const createHref = contextAwareCreateHref(pathname, scopedParams);

  useEffect(() => setHidden(false), [pathname, setHidden]);

  if (keyboardVisible || !primaryNavigationVisibleForPath(pathname)) return null;

  return <FloatingNavigation
    activeKey={activeKey}
    createDisabled={!release.tasks}
    hidden={hidden}
    items={items}
    onCreate={() => {
      if (pathname.endsWith('/tasks') && scopedParams.projectId) {
        router.setParams({ create: '1', groupId: scopedParams.groupId });
        return;
      }
      if (pathname.endsWith('/today')) {
        router.setParams({ create: String(Date.now()) });
        return;
      }
      if (pathname.endsWith('/projects')) {
        router.setParams({ create: String(Date.now()) });
        return;
      }
      router.push(createHref as never);
    }}
    onSelect={(item) => {
      const route = visibleRoutes.find((candidate) => candidate.name === item.href);
      if (!route || item.disabled) return;
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      const resetTarget = primaryTabResetTarget(item.key);
      if (resetTarget) navigation.navigate(route.name, resetTarget);
      else navigation.navigate(route.name, route.params);
    }}
  />;
}

function contextAwareCreateHref(pathname: string, params: NavigationParams) {
  const projectId = typeof params.projectId === 'string' ? params.projectId as Id<'projects'> : undefined;
  if (!projectId && pathname.endsWith('/projects')) return `/projects?create=${Date.now()}`;
  if (!projectId) return `/today?create=${Date.now()}`;

  const projectScopedRoute = pathname.endsWith('/project') || pathname.endsWith('/groups') || pathname.endsWith('/conversation') || pathname.endsWith('/tasks');
  if (!projectScopedRoute) return `/today?create=${Date.now()}`;

  const identity = params.companyId && params.membershipId ? {
    archived: params.archive === '1',
    companyId: params.companyId as Id<'companies'>,
    membershipId: params.membershipId as Id<'projectMembers'>,
  } : null;
  const groupId = typeof params.groupId === 'string' ? params.groupId as Id<'groups'> : undefined;
  return taskListHref(projectId, identity, undefined, undefined, { create: true, groupId });
}

function FloatingNavigation({ activeKey, createDisabled, hidden, items, onCreate, onSelect }: {
  activeKey?: StandaloneTabKey;
  createDisabled: boolean;
  hidden: boolean;
  items: Array<NavigationItem | (PrimaryDestination & { href: string })>;
  onCreate: () => void;
  onSelect: (item: NavigationItem | (PrimaryDestination & { href: string })) => void;
}) {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const navigationHeight = primaryNavigationHeight(fontScale, BottomTabInset);
  const reducedMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const hiddenProgress = useSharedValue(hidden ? 1 : 0);
  const dragX = useSharedValue(0);
  const dragOpacity = useSharedValue(0);
  const dragStretch = useSharedValue(1);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);

  useEffect(() => {
    hiddenProgress.set(reducedMotion
      ? withTiming(hidden ? 1 : 0, { duration: 120 })
      : withSpring(hidden ? 1 : 0, { dampingRatio: 1, duration: 280 }));
  }, [hidden, hiddenProgress, reducedMotion]);

  function commitDrag(index: number) {
    const item = items[index];
    if (item && !item.disabled) onSelect(item);
  }

  const drag = Gesture.Pan()
    .activateAfterLongPress(180)
    .onBegin((event) => {
      dragX.set(event.x);
      dragOpacity.set(1);
      dragStretch.set(1.08);
    })
    .onUpdate((event) => {
      dragX.set(Math.max(28, Math.min(rowWidth - 28, event.x)));
      dragStretch.set(Math.min(1.28, 1 + Math.abs(event.velocityX) / 3_000));
    })
    .onEnd((event) => {
      const index = primaryDestinationIndexAtX(event.x, rowWidth);
      const slot = index < 2 ? index : index + 1;
      const target = (slot + 0.5) * (rowWidth / 5);
      dragX.set(reducedMotion ? target : withSpring(target, { dampingRatio: 1, duration: 320, velocity: event.velocityX }));
      dragStretch.set(withSpring(1, { dampingRatio: 1, duration: 220 }));
      dragOpacity.set(withTiming(0, { duration: reducedMotion ? 80 : 140 }));
      scheduleOnRN(commitDrag, index);
    })
    .onFinalize(() => {
      dragStretch.set(withSpring(1, { dampingRatio: 1, duration: 180 }));
      dragOpacity.set(withTiming(0, { duration: 100 }));
    });

  const positionStyle = useAnimatedStyle(() => ({
    opacity: 1 - hiddenProgress.get(),
    transform: [{ translateY: hiddenProgress.get() * (navigationHeight + insets.bottom + 24) }],
  }));
  const dragStyle = useAnimatedStyle(() => ({
    opacity: dragOpacity.get(),
    transform: [{ translateX: dragX.get() - 39 }, { scaleX: dragStretch.get() }],
  }));

  return <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.positioner, { paddingBottom: Math.max(insets.bottom, Spacing.two) }, positionStyle]}>
    <View style={[styles.chrome, { backgroundColor: reduceTransparency ? theme.homeSurface : 'transparent', borderColor: theme.homeBorder, height: navigationHeight }]}>
      {!reduceTransparency ? <BlurView intensity={Platform.OS === 'ios' ? 22 : 18} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blurSurface, { backgroundColor: theme.navigationGlass, opacity: Platform.OS === 'ios' ? 0.72 : 1 }]} tint={themeName === 'dark' ? 'dark' : 'light'} /> : null}
      <GestureDetector gesture={drag}>
        <View accessibilityRole="tablist" onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)} style={[styles.row, { height: navigationHeight }]}>
          <Animated.View pointerEvents="none" style={[styles.dragPill, { backgroundColor: theme.navigationSelectionGlass, borderColor: theme.homeBorder }, dragStyle]} />
          {left.map((item) => <NavigationTab active={item.key === activeKey} item={item} key={item.key} onPress={() => onSelect(item)} />)}
          <CreateButton disabled={createDisabled} height={navigationHeight} onPress={onCreate} />
          {right.map((item) => <NavigationTab active={item.key === activeKey} item={item} key={item.key} onPress={() => onSelect(item)} />)}
        </View>
      </GestureDetector>
    </View>
  </Animated.View>;
}

function NavigationTab({ active, item, onPress }: {
  active: boolean;
  item: NavigationItem | (PrimaryDestination & { href: string });
  onPress: () => void;
}) {
  const theme = useTheme();
  return <Pressable
    accessibilityLabel={item.label}
    accessibilityRole="tab"
    accessibilityState={{ disabled: item.disabled, selected: active }}
    disabled={item.disabled}
    onPress={() => { hapticLight(); onPress(); }}
    style={({ pressed }) => [styles.item, { opacity: item.disabled ? 0.38 : pressed ? 0.62 : 1 }]}
  >
    <View style={[styles.iconWell, active && { backgroundColor: theme.navigationSelectionGlass, borderColor: theme.homeBorder }]}>
      <PlatformIcon color={active ? theme.accentStrong : theme.textSecondary} name={item.icon} size={IconSize.large + 4} variant={active ? 'filled' : 'outline'} weight={active ? 'semibold' : 'regular'} />
    </View>
    <ThemedText numberOfLines={1} style={[styles.itemLabel, { color: active ? theme.accentStrong : theme.textSecondary }]} type="captionBold">{item.label}</ThemedText>
  </Pressable>;
}

function CreateButton({ disabled, height, onPress }: { disabled: boolean; height: number; onPress: () => void }) {
  const theme = useTheme();
  return <View style={[styles.createSlot, { height }]}>
    <View style={[styles.createMoat, { backgroundColor: theme.homeBackground }]}><Pressable
      accessibilityHint="Choose a Project before creating a task"
      accessibilityLabel="Create"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { hapticLight(); onPress(); }}
      style={({ pressed }) => [styles.createButton, { backgroundColor: disabled ? theme.backgroundSelected : theme.accent, borderColor: theme.accentStrong, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      <PlatformIcon color={disabled ? theme.textTertiary : theme.background} name="plus" size={31} weight="medium" />
    </Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  blurSurface: { borderRadius: Radius.pill, overflow: 'hidden' },
  chrome: { borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', height: BottomTabInset, overflow: 'visible' },
  createButton: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 58, justifyContent: 'center', width: 58 },
  createMoat: { alignItems: 'center', borderRadius: Radius.pill, height: 70, justifyContent: 'center', width: 70 },
  createSlot: { alignItems: 'center', flex: 1, height: BottomTabInset, justifyContent: 'flex-start', transform: [{ translateY: -14 }] },
  dragPill: { borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 58, left: 0, position: 'absolute', top: 9, width: 78 },
  iconWell: { alignItems: 'center', borderColor: 'transparent', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 40, justifyContent: 'center', width: 48 },
  item: { alignItems: 'center', alignSelf: 'center', flex: 1, justifyContent: 'center', minHeight: 60, minWidth: 0 },
  itemLabel: { fontSize: 10, lineHeight: 13, marginTop: 1 },
  positioner: { bottom: 0, left: 0, paddingHorizontal: 20, paddingTop: Spacing.two, position: 'absolute', right: 0, zIndex: 50 },
  row: { alignItems: 'center', flexDirection: 'row', height: BottomTabInset, overflow: 'visible', paddingHorizontal: Spacing.two },
});
