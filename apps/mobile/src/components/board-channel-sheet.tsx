import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';

type Props = {
  boardName: string;
  channelAvailable: boolean;
  channelName?: string;
  onClose: () => void;
  onOpenChannel: () => void;
  unreadCount?: number;
  visible: boolean;
};

/** Shows the actual unread Channel count associated with a Channel Board. */
export function BoardChannelSheet({
  boardName,
  channelAvailable,
  channelName,
  onClose,
  onOpenChannel,
  unreadCount,
  visible,
}: Props) {
  return (
    <OptionsSheet onClose={onClose} title={`${boardName} Channel`} visible={visible}>
      {channelAvailable ? <>
        <SheetNote>
          {unreadCount === undefined
            ? 'Loading the Channel unread count…'
            : `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}${channelName ? ` in #${channelName}` : ' in this Channel'}.`}
        </SheetNote>
        <SheetSection title="Channel">
          <SheetRow detail="Open the conversation" icon="channel" label={channelName ? `Open #${channelName}` : 'Open Channel'} onPress={onOpenChannel} />
        </SheetSection>
      </> : <SheetNote>No Channel is linked to this Board.</SheetNote>}
    </OptionsSheet>
  );
}
