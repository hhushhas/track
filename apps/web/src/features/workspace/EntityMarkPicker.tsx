import { entityMarkColorKeys, entityMarkIconKeys, type EntityMarkColorKey, type EntityMarkIconKey } from '@track/shared'

const iconLabels: Record<EntityMarkIconKey, string> = {
  analytics: 'Analytics', board: 'Board', book: 'Knowledge', building: 'Company', calendar: 'Calendar',
  channel: 'Channel', code: 'Engineering', conversation: 'Conversation', design: 'Design',
  launch: 'Launch', people: 'People', project: 'Project', shield: 'Security',
}

export function EntityMarkPicker({
  colorKey,
  iconKey,
  onColorChange,
  onIconChange,
}: {
  colorKey: EntityMarkColorKey | ''
  iconKey: EntityMarkIconKey | ''
  onColorChange: (value: EntityMarkColorKey | '') => void
  onIconChange: (value: EntityMarkIconKey | '') => void
}) {
  return (
    <fieldset className="track-entity-mark-picker">
      <legend>Identity</legend>
      <label>
        <span>Icon</span>
        <select onChange={(event) => onIconChange(event.currentTarget.value as EntityMarkIconKey | '')} value={iconKey}>
          <option value="">Automatic</option>
          {entityMarkIconKeys.map((key) => <option key={key} value={key}>{iconLabels[key]}</option>)}
        </select>
      </label>
      <label>
        <span>Background</span>
        <select onChange={(event) => onColorChange(event.currentTarget.value as EntityMarkColorKey | '')} value={colorKey}>
          <option value="">Automatic</option>
          {entityMarkColorKeys.map((key) => <option key={key} value={key}>{key[0]!.toUpperCase() + key.slice(1)}</option>)}
        </select>
      </label>
      <p>Automatic keeps the background stable and chooses an icon from the name.</p>
    </fieldset>
  )
}
