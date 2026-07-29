const eventName = 'flare:web-onboarding';

function storageKey(uid: string) {
  return `flare.web.onboarding.${uid}`;
}

export function queueWebOnboarding(uid: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(uid), 'pending');
  window.dispatchEvent(new CustomEvent(eventName, { detail: { uid } }));
}

export function hasPendingWebOnboarding(uid: string) {
  return typeof window !== 'undefined' && localStorage.getItem(storageKey(uid)) === 'pending';
}

export function completeWebOnboarding(uid: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(uid));
}

export const webOnboardingEventName = eventName;
