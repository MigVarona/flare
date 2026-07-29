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
  eligibleUids: string[] = rotation.members,
): string | null {
  const eligible = new Set(eligibleUids);
  if (eligible.size === 0) return null;

  const currentUid = currentTargetUids?.[0];
  const currentIndex = currentUid ? rotation.members.indexOf(currentUid) : -1;

  // Keep the original turn order, but skip people who have since left the space. A cast
  // is immutable so historical order survives; eligibility is the living membership now.
  for (let offset = 1; offset <= rotation.members.length; offset += 1) {
    const index = (Math.max(currentIndex, -1) + offset) % rotation.members.length;
    const candidate = rotation.members[index];
    if (eligible.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Who should see a reminder was completed — everyone with a stake in it who isn't the one
 * who just acted: whoever asked, and whoever else it was ringing on. That last part matters
 * for a reminder aimed at several people at once ("para todos"): the others learn someone
 * already handled it, instead of finding out by doing it twice.
 */
export function reminderDoneAudience(
  createdByUid: string | undefined,
  targetUids: string[] | undefined,
  completedByUid: string,
): string[] {
  const audience = new Set(
    [createdByUid, ...(targetUids ?? [])].filter((uid): uid is string => Boolean(uid)),
  );
  audience.delete(completedByUid);
  return [...audience];
}
