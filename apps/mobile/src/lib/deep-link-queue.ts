import { router } from 'expo-router';

/**
 * A notification tap that launches the app cold fires before the root `Stack` exists —
 * fonts and auth are still resolving, and `Stack.Protected` hasn't settled into the
 * signed-in branch yet. `router.push` at that moment lands nowhere: no screen is ever
 * mounted to receive it, and the splash hides regardless, leaving a blank view.
 *
 * This queues that one URL until `markNavigationReady` says the signed-in stack is
 * actually on screen, instead of firing blind into a navigator that isn't there yet.
 */
let ready = false;
let pending: string | null = null;

export function markNavigationReady() {
  if (ready) return;
  ready = true;
  if (pending) {
    const url = pending;
    pending = null;
    router.push(url as never);
  }
}

export function goWhenReady(url: string) {
  if (ready) {
    router.push(url as never);
  } else {
    pending = url;
  }
}
