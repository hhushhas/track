export type MessageSwipeIntent = 'actions' | 'reply' | 'close';

/** Returns an interrupted gesture to its last settled tray state. */
export function messageSwipeCancelIntent(trayAlreadyOpen: boolean): MessageSwipeIntent {
  'worklet';
  return trayAlreadyOpen ? 'actions' : 'close';
}

/** Maps a completed horizontal drag to the action surface it is allowed to open. */
export function messageSwipeIntent(translationX: number, canReply: boolean, canOpenActions: boolean, trayAlreadyOpen = false): MessageSwipeIntent {
  'worklet';
  if (trayAlreadyOpen) return translationX >= 56 ? 'close' : 'actions';
  if (translationX <= -56 && canOpenActions) return 'actions';
  if (translationX >= 56 && canReply) return 'reply';
  return 'close';
}
