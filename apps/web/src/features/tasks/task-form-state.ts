export function resolveWorkflowStateId<T extends string>(
  states: ReadonlyArray<{ _id: T; isDefault?: boolean }>,
  currentStateId: string,
) {
  if (states.some((state) => state._id === currentStateId)) return currentStateId
  return states.find((state) => state.isDefault)?._id ?? states[0]?._id ?? ''
}
