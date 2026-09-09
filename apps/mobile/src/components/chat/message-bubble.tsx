import { Pressable, StyleSheet, View } from 'react-native';

import { AttachmentList } from '@/components/chat/attachment-list';
import { MessageText } from '@/components/chat/message-text';
import type { DetailedMessage } from '@/components/chat/types';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { isAutoAttachmentBody, isImageAttachment } from '@/lib/attachment-presentation';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { displayText } from '@/lib/display-text';

const AVATAR_SIZE = 32;
/** Media sits nearly edge-to-edge; text sections add the rest of the inset. */
const MEDIA_PAD = 3;

type Props = {
  isFirstInGroup: boolean;
  isOwnMessage: boolean;
  message: DetailedMessage;
  onOpenForwardSource?: () => void;
  onLongPress: () => void;
  onOpenThread?: () => void;
  onPressReply?: () => void;
  timeLabel: string;
};

export function MessageBubble({
  isFirstInGroup,
  isOwnMessage,
  message,
  onOpenForwardSource,
  onLongPress,
  onOpenThread,
  onPressReply,
  timeLabel,
}: Props) {
  const theme = useTheme();
  const name = message.author?.displayName ?? 'Member';
  const authorId = message.author?._id ?? name;
  const rawBody = displayText(message.message.body.trim());
  const body = message.attachments.length && isAutoAttachmentBody(rawBody) ? '' : rawBody;
  const showHeader = isFirstInGroup && !isOwnMessage;
  const hasMedia = message.attachments.some(
    ({ attachment, url }) => url && isImageAttachment(attachment.contentType),
  );
  // Media-closed bubbles overlay the timestamp on the image, WhatsApp-style.
  const mediaClosesBubble =
    hasMedia &&
    !body &&
    !message.channelThread &&
    message.attachments.every(
      ({ attachment, url }) => url && isImageAttachment(attachment.contentType),
    );

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}>
      {isOwnMessage ? null : isFirstInGroup ? (
        <ColoredAvatar label={name} seed={authorId} size={AVATAR_SIZE} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <Pressable
        accessible={false}
        onLongPress={onLongPress}
        style={[
          styles.bubble,
          hasMedia ? styles.bubbleMedia : styles.bubbleText,
          { backgroundColor: isOwnMessage ? theme.bubbleOwn : theme.bubbleOther },
          isFirstInGroup && (isOwnMessage ? styles.tailOwn : styles.tailOther),
        ]}>
        {showHeader ? (
          <View style={[styles.header, hasMedia && styles.inset, hasMedia && styles.insetTop]}>
            <ThemedText numberOfLines={1} style={styles.authorName} type="smallBold">
              {name}
            </ThemedText>
          </View>
        ) : null}

        {message.replyTo ? (
          <Pressable
            accessibilityHint={onPressReply ? 'Shows the quoted message' : undefined}
            accessibilityLabel={`Replying to ${message.replyTo.authorName}: ${message.replyTo.body}`}
            accessibilityRole={onPressReply ? 'button' : 'text'}
            accessibilityState={{ disabled: !onPressReply }}
            disabled={!onPressReply}
            onLongPress={onLongPress}
            onPress={() => {
              if (!onPressReply) return;
              hapticLight();
              onPressReply();
            }}
            style={[
              styles.quote,
              hasMedia && styles.quoteInMedia,
              { backgroundColor: theme.backgroundElevated, borderLeftColor: theme.textTertiary },
            ]}>
            <View style={[styles.replyAuthorPill, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">
                {message.replyTo.authorName}
              </ThemedText>
            </View>
            <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">
              {displayText(message.replyTo.body)}
            </ThemedText>
          </Pressable>
        ) : null}

        {message.forwardedFrom ? (
          <ForwardedMessageBlock
            forwarded={message.forwardedFrom}
            onOpenSource={onOpenForwardSource}
          />
        ) : null}

        {message.attachments.length ? (
          <AttachmentList attachments={message.attachments} onLongPress={onLongPress} />
        ) : null}

        {body ? (
          <View style={hasMedia ? styles.inset : null}>
            <View>
              <MessageText body={body} />
              <ThemedText
                accessibilityLabel={`Sent at ${timeLabel}`}
                style={styles.timeFooter}
                themeColor="textSecondary"
                type="caption">
                {timeLabel}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {message.channelThread ? (
          <Pressable
            accessibilityHint={onOpenThread ? 'Opens the thread' : undefined}
            accessibilityLabel={`Thread ${message.channelThread.name}, ${message.channelThread.replyCount} ${
              message.channelThread.replyCount === 1 ? 'reply' : 'replies'
            }${message.channelThread.status === 'archived' ? ', archived' : ''}`}
            accessibilityRole={onOpenThread ? 'button' : 'text'}
            accessibilityState={{ disabled: !onOpenThread }}
            android_ripple={{ color: theme.backgroundSelected }}
            disabled={!onOpenThread}
            onLongPress={onLongPress}
            onPress={() => {
              if (!onOpenThread) return;
              hapticLight();
              onOpenThread();
            }}
            style={[
              styles.threadChip,
              hasMedia && styles.inset,
              { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline },
            ]}>
            <PlatformIcon color={theme.textSecondary} name="forum-outline" size={15} />
            <View style={styles.threadBody}>
              <ThemedText numberOfLines={1} type="captionBold">
                {message.channelThread.name}
              </ThemedText>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
                {`${message.channelThread.replyCount} ${
                  message.channelThread.replyCount === 1 ? 'reply' : 'replies'
                }${message.channelThread.status === 'archived' ? ' · Archived' : ''}`}
              </ThemedText>
            </View>
            {onOpenThread ? (
              <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />
            ) : null}
          </Pressable>
        ) : null}

        {body ? null : mediaClosesBubble ? (
          <View style={[styles.timeOverlay, { backgroundColor: theme.overlay }]}>
            <ThemedText
              accessibilityLabel={`Sent at ${timeLabel}`}
              style={styles.timeOverlayText}
              type="caption">
              {timeLabel}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            accessibilityLabel={`Sent at ${timeLabel}`}
            style={[styles.timeFooter, hasMedia && styles.inset]}
            themeColor="textSecondary"
            type="caption">
            {timeLabel}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

function ForwardedMessageBlock({
  forwarded,
  onOpenSource,
}: {
  forwarded: NonNullable<DetailedMessage['forwardedFrom']>;
  onOpenSource?: () => void;
}) {
  const theme = useTheme();
  const attachmentCount = forwarded.attachmentSnapshots.length;
  const sourceLabel = forwarded.sourceGroupName
    ? `Forwarded from ${forwarded.sourceGroupName}`
    : 'Forwarded message';

  return (
    <Pressable
      accessibilityHint={onOpenSource ? 'Opens the original message' : 'The original message is outside your access'}
      accessibilityLabel={`${sourceLabel}. ${forwarded.originalAuthorName}: ${forwarded.originalBody || 'Attachment message'}`}
      accessibilityRole={onOpenSource ? 'link' : 'text'}
      accessibilityState={{ disabled: !onOpenSource }}
      disabled={!onOpenSource}
      onPress={onOpenSource}
      style={[styles.forwarded, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
      <View style={styles.forwardedLabel}>
        <PlatformIcon color={theme.textSecondary} name="forward" size={14} />
        <ThemedText themeColor="textSecondary" type="captionBold">{sourceLabel}</ThemedText>
      </View>
      <ThemedText type="captionBold">{forwarded.originalAuthorName}</ThemedText>
      <ThemedText numberOfLines={3} themeColor="textSecondary" type="small">
        {displayText(forwarded.originalBody) || 'Attachment message'}
      </ThemedText>
      {attachmentCount ? (
        <ThemedText themeColor="textSecondary" type="caption">
          {attachmentCount} copied {attachmentCount === 1 ? 'attachment' : 'attachments'}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  authorName: {
    flexShrink: 1,
    minWidth: 0,
  },
  avatarSpacer: {
    width: AVATAR_SIZE,
  },
  forwarded: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
    margin: MEDIA_PAD,
    padding: Spacing.two,
  },
  forwardedLabel: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  bubble: {
    borderRadius: Radius.large,
    flexShrink: 1,
    gap: Spacing.one,
    maxWidth: '84%',
  },
  bubbleMedia: {
    padding: MEDIA_PAD,
  },
  bubbleText: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  companyBadge: {
    alignItems: 'flex-start',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 3,
    minWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  companyName: {
    flexShrink: 1,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    minWidth: 0,
  },
  inset: {
    paddingHorizontal: 5,
  },
  insetTop: {
    paddingTop: MEDIA_PAD,
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: Radius.small,
    gap: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  quoteInMedia: {
    marginHorizontal: MEDIA_PAD,
    marginTop: MEDIA_PAD,
  },
  replyAuthorPill: { alignSelf: 'flex-start', borderRadius: Radius.pill, maxWidth: '80%', paddingHorizontal: Spacing.two, paddingVertical: 2 },
  roleChip: {
    borderRadius: Radius.small,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  tailOther: {
    borderTopLeftRadius: Radius.small,
  },
  tailOwn: {
    borderTopRightRadius: Radius.small,
  },
  threadBody: {
    flexShrink: 1,
    gap: 1,
    minWidth: 0,
  },
  threadChip: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  timeFooter: {
    alignSelf: 'flex-end',
  },
  timeOverlay: {
    borderRadius: Radius.pill,
    bottom: MEDIA_PAD + 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    position: 'absolute',
    right: MEDIA_PAD + 6,
  },
  timeOverlayText: {
    color: Colors.dark.text,
  },
});
