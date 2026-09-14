import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';

export type CompanyAudience = { displayName: string; _id?: string };

export function CompanyHeaderTitle() {
  const theme = useTheme();
  return <View style={styles.headerTitle}>
    <View style={[styles.headerMark, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.text} name="clock-outline" size={17} /></View>
    <View><ThemedText numberOfLines={1} style={styles.headerHeading} type="title">Companies</ThemedText></View>
  </View>;
}

export function CompanyPageIntro() {
  return <View style={styles.intro}><View style={styles.introCopy}><ThemedText style={styles.eyebrow} themeColor="textSecondary" type="mono">WORKSPACE IDENTITY</ThemedText><ThemedText type="titleLarge">Companies</ThemedText></View></View>;
}

export function CompanyTrustNotice() {
  const theme = useTheme();
  return <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.accentStrong} name="shield-check" size={17} /><ThemedText style={styles.flex} themeColor="textSecondary" type="caption">Swapping identity changes your signature badge in timelines, audit evidence, and Project handoffs.</ThemedText></View>;
}

export function ActingCompanyCard({ companyId, companyName, projectCount, role, status }: { companyId?: string; companyName?: string; projectCount?: number | string; role: string; status?: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  const active = !companyName || status === 'active';
  const label = companyName ?? 'Personal Projects';
  return <View style={styles.identitySection}>
    <View style={styles.between}><ThemedText style={styles.eyebrow} themeColor="textSecondary" type="mono">ACTING AS</ThemedText><View style={[styles.livePill, { backgroundColor: active ? theme.accentSoft : theme.backgroundSelected }]}><View style={[styles.liveDot, { backgroundColor: active ? theme.accent : theme.textTertiary }]} /><ThemedText themeColor={active ? 'accentStrong' : 'textSecondary'} type="mono">{active ? 'Active' : 'Suspended'}</ThemedText></View></View>
    <View style={[styles.identityCard, { backgroundColor: theme.backgroundElevated }]}>
      <View style={[styles.identityMain, largeText && styles.identityMainLarge]}>{companyName ? <ColoredAvatar label={companyName} seed={companyId} shape="rounded" size={52} /> : <View style={[styles.personalAvatar, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="person" size={24} /></View>}<View style={styles.flex}><View style={styles.identityName}><ThemedText type="subtitle">{label}</ThemedText>{companyName && active ? <PlatformIcon color={theme.accent} name="shield-check" size={16} /> : null}</View><ThemedText themeColor="textSecondary" type="caption">{role}</ThemedText></View><PlatformIcon color={theme.textTertiary} name="chevron-down" size={16} /></View>
      <View style={[styles.identityMeta, largeText && styles.identityMetaLarge, { backgroundColor: theme.backgroundElement }]}><View style={styles.metaCopy}><PlatformIcon color={theme.textSecondary} name="project" size={14} /><ThemedText themeColor="textSecondary" type="caption">{projectCount === undefined ? 'Projects loading' : `${projectCount} ${projectCount === 1 || projectCount === '1' ? 'Project' : 'Projects'} linked`}</ThemedText></View>{companyId ? <ThemedText numberOfLines={1} style={styles.identityCode} themeColor="textTertiary" type="mono">{companyId.slice(-8).toUpperCase()}</ThemedText> : null}</View>
    </View>
  </View>;
}

export function CompanySectionHeading({ count, meta, title }: { count?: number; meta?: string; title: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.sectionHeading, largeText && styles.sectionHeadingLarge]}><View style={styles.headingCopy}><ThemedText style={styles.eyebrow} themeColor="textSecondary" type="mono">{title}</ThemedText>{count ? <View style={[styles.countPill, { backgroundColor: theme.accentSoft }]}><ThemedText themeColor="accentStrong" type="mono">{count}</ThemedText></View> : null}</View>{meta ? <ThemedText themeColor="textTertiary" type="caption">{meta}</ThemedText> : null}</View>;
}

export function CompanyChoice({ count, detail, label, onPress, personal, selected, suspended }: { count?: string; detail: string; label: string; onPress: () => void; personal?: boolean; selected: boolean; suspended?: boolean }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.choiceSurface, { backgroundColor: suspended ? theme.backgroundElement : theme.backgroundElevated, opacity: suspended ? 0.58 : 1 }]}><Pressable accessibilityLabel={`${label}. ${detail}`} accessibilityRole="radio" accessibilityState={{ disabled: suspended, selected }} disabled={suspended} onPress={() => { hapticLight(); onPress(); }} style={styles.choice}>
    <View style={[styles.radio, { borderColor: selected ? theme.text : theme.hairline }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: theme.text }]} /> : null}</View>
    <View style={styles.flex}><View style={styles.choiceTitle}><ThemedText numberOfLines={largeText ? undefined : 2} type="title">{label}</ThemedText>{selected ? <View style={[styles.currentPill, { backgroundColor: theme.accentSoft }]}><ThemedText themeColor="accentStrong" type="mono">CURRENT</ThemedText></View> : null}</View><ThemedText numberOfLines={largeText ? undefined : 2} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>
    {count ? <ThemedText themeColor="textTertiary" type="mono">{count}</ThemedText> : personal ? null : suspended ? <PlatformIcon color={theme.textTertiary} name="alert-circle" size={17} /> : null}
  </Pressable></View>;
}

export function InvitationCard({ acceptLabel = 'Accept', audience, audienceLabel, busy, decision, detail, eyebrow, onAccept, onDecline, title }: { acceptLabel?: string; audience?: CompanyAudience[]; audienceLabel?: string; busy: boolean; decision: 'accept' | 'decline' | null; detail: string; eyebrow?: string; onAccept: () => void; onDecline: () => void; title: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.invitation, { backgroundColor: theme.backgroundElevated, borderLeftColor: theme.accent }]}>
    <View style={styles.invitationHeader}><ColoredAvatar label={title} shape="rounded" size={44} /><View style={styles.flex}>{eyebrow ? <ThemedText style={styles.eyebrow} themeColor="textSecondary" type="mono">{eyebrow}</ThemedText> : null}<ThemedText type="title">{title}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{detail}</ThemedText></View></View>
    {audienceLabel ? <View style={[styles.accessNote, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="shield-lock-outline" size={15} /><ThemedText style={styles.flex} themeColor="textSecondary" type="caption">{audienceLabel}</ThemedText></View> : null}
    {audience?.length ? <View style={styles.audience}>{audience.map((company) => <View key={company._id ?? company.displayName} style={styles.audienceItem}><ColoredAvatar label={company.displayName} seed={company._id} shape="rounded" size={22} /><ThemedText numberOfLines={1} style={styles.flex} type="caption">{company.displayName}</ThemedText></View>)}</View> : null}
    <View style={[styles.actions, largeText && styles.actionsLarge]}><ActionButton disabled={busy} icon="check" label={acceptLabel} loading={decision === 'accept'} onPress={onAccept} style={styles.action} /><ActionButton disabled={busy} label="Decline" loading={decision === 'decline'} onPress={onDecline} style={styles.declineAction} variant="secondary" /></View>
  </View>;
}

export function RelationshipCard({ companies, name }: { companies: CompanyAudience[]; name: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.relationship, { backgroundColor: theme.backgroundElevated }]}><ThemedText type="title">{name}</ThemedText><View style={styles.relationshipChain}>{companies.map((company, index) => <View key={company._id ?? company.displayName} style={[styles.relationshipSequence, largeText && styles.relationshipSequenceLarge]}><View style={[styles.relationshipEntry, largeText && styles.relationshipEntryLarge]}><ColoredAvatar label={company.displayName} seed={company._id} shape="rounded" size={44} /><ThemedText numberOfLines={largeText ? undefined : 2} style={[styles.relationshipName, largeText && styles.relationshipNameLarge]} type="captionBold">{company.displayName}</ThemedText></View>{index < companies.length - 1 ? <View style={styles.bridge}><View style={[styles.bridgeLine, { borderColor: theme.hairline }]} /><ThemedText themeColor="textTertiary" type="mono">↔</ThemedText></View> : null}</View>)}</View><ThemedText themeColor="textTertiary" type="mono">BRIDGED COMPANY RELATIONSHIP</ThemedText></View>;
}

export function CompanyWebNote() {
  const theme = useTheme();
  return <View style={[styles.webNote, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="open-in-new" size={16} /><ThemedText style={styles.flex} themeColor="textSecondary" type="caption">Relationship administration and protocol permissions are managed on web by authorized Company owners and administrators.</ThemedText></View>;
}

const styles = StyleSheet.create({
  accessNote: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.two, minHeight: 42, padding: Spacing.two }, action: { flex: 1 }, actions: { flexDirection: 'row', gap: Spacing.two }, actionsLarge: { flexDirection: 'column' }, audience: { gap: Spacing.one }, audienceItem: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, between: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, bridge: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.one, minWidth: 40 }, bridgeLine: { borderTopWidth: StyleSheet.hairlineWidth, flex: 1 }, choice: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 72, padding: Spacing.three }, choiceSurface: { borderCurve: 'continuous', borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }, choiceTitle: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, countPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 2 }, currentPill: { borderRadius: Radius.small, paddingHorizontal: Spacing.one, paddingVertical: 1 }, declineAction: { minWidth: 92 }, eyebrow: { fontSize: 10, letterSpacing: 1, lineHeight: 14 }, flex: { flex: 1, minWidth: 0 }, headerHeading: { lineHeight: 17 }, headerMark: { alignItems: 'center', borderRadius: Radius.large, height: 36, justifyContent: 'center', width: 36 }, headerTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, headingCopy: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, identityCard: { borderCurve: 'continuous', borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', gap: Spacing.three, padding: Spacing.four }, identityCode: { flexShrink: 1 }, identityMain: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three }, identityMainLarge: { alignItems: 'flex-start' }, identityMeta: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.small, flexDirection: 'row', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: Spacing.two }, identityMetaLarge: { alignItems: 'flex-start', flexDirection: 'column', gap: Spacing.one, paddingVertical: Spacing.two }, identityName: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, identitySection: { gap: Spacing.two }, intro: { alignItems: 'center', flexDirection: 'row', minHeight: 58 }, introCopy: { alignItems: 'center', flex: 1 }, invitation: { borderCurve: 'continuous', borderLeftWidth: 4, borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', gap: Spacing.three, overflow: 'hidden', padding: Spacing.four }, invitationHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three }, liveDot: { borderRadius: Radius.pill, height: 7, width: 7 }, livePill: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 3 }, metaCopy: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one }, notice: { alignItems: 'flex-start', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three }, personalAvatar: { alignItems: 'center', borderRadius: Radius.medium, height: 52, justifyContent: 'center', width: 52 }, protocolFooter: { alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.four, paddingVertical: Spacing.five }, protocolTitle: { letterSpacing: 1.5, textAlign: 'center' }, radio: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 }, radioDot: { borderRadius: Radius.pill, height: 8, width: 8 }, relationship: { borderCurve: 'continuous', borderRadius: Radius.medium, gap: Spacing.three, padding: Spacing.four }, relationshipChain: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, relationshipEntry: { alignItems: 'center', gap: Spacing.one, maxWidth: 92 }, relationshipEntryLarge: { alignItems: 'flex-start', maxWidth: '100%' }, relationshipName: { textAlign: 'center' }, relationshipNameLarge: { textAlign: 'left' }, relationshipSequence: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, relationshipSequenceLarge: { flexShrink: 1 }, sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two }, sectionHeadingLarge: { alignItems: 'flex-start', flexDirection: 'column', gap: Spacing.one }, webNote: { alignItems: 'flex-start', borderCurve: 'continuous', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
});
