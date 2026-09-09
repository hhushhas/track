import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
import type { IconName } from '@/components/platform-icon';

type Action = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void };

type Props = { visible: boolean; onClose: () => void; actions: Action[] };

export function MessageActions({ visible, onClose, actions }: Props) {
  return (
    <OptionsSheet onClose={onClose} title="Message actions" visible={visible}>
      <SheetSection>
        {actions.map((action) => (
          <SheetRow
            destructive={action.destructive}
            icon={action.icon}
            key={action.label}
            label={action.label}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          />
        ))}
      </SheetSection>
    </OptionsSheet>
  );
}
