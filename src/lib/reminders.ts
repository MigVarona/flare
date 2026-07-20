/**
 * Rotation: a repeating reminder that hands itself to the next person each time it's done,
 * instead of ringing on the same phone forever. It answers the one question every shared
 * chore actually asks — "whose turn is it?" — with a colour instead of a conversation.
 *
 * `members` is the fixed cast, in the order chosen when the reminder was made. `targetUids`
 * (elsewhere) always holds exactly the current turn — one person, never the whole cast at
 * once, because a turn is something one of you takes.
 */
export type Rotation = { members: string[] };

/**
 * Whoever's turn is next, wrapping back to the start of the cast.
 *
 * If the current holder can't be placed in the cast any more — they left the space after
 * taking their turn — there's no "next" to count from, so it restarts at the first member
 * rather than guessing.
 */
export function nextRotationTarget(
  rotation: Rotation,
  currentTargetUids: string[] | undefined,
): string {
  const currentUid = currentTargetUids?.[0];
  const currentIndex = currentUid ? rotation.members.indexOf(currentUid) : -1;
  if (currentIndex === -1) return rotation.members[0];
  return rotation.members[(currentIndex + 1) % rotation.members.length];
}
