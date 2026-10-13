import type { Actor, CategoryId, ConsentState } from './types';

export class ConsentError extends Error {}

export const initialConsent = (): ConsentState => ({ status: 'notInvited', shared: [], history: [] });

const log = (c: ConsentState, actor: Actor, action: string, at: number, detail?: string): ConsentState => ({
  ...c,
  history: [...c.history, { at, actor, action, detail }],
});

function only(actor: Actor, required: Actor, action: string) {
  if (actor !== required) {
    throw new ConsentError(`${action} can only be done by the ${required === 'monitored' ? 'person being invited' : 'family member'}`);
  }
}

/** Family sends (or re-sends after a decline/revoke) an invitation. Nothing is shared yet. */
export function sendInvite(c: ConsentState, actor: Actor, at = Date.now()): ConsentState {
  only(actor, 'family', 'Sending an invitation');
  if (c.status === 'pending' || c.status === 'accepted') throw new ConsentError('An invitation is already active');
  return log({ ...c, status: 'pending', shared: [] }, actor, 'invite_sent', at);
}

/** Only the monitored person can accept, and must pick at least one category. */
export function accept(c: ConsentState, actor: Actor, categories: CategoryId[], at = Date.now()): ConsentState {
  only(actor, 'monitored', 'Accepting');
  if (c.status !== 'pending') throw new ConsentError('There is no pending invitation to accept');
  const shared = [...new Set(categories)];
  if (shared.length === 0) throw new ConsentError('Choose at least one thing to share, or decline');
  return log({ ...c, status: 'accepted', shared }, actor, 'accepted', at, shared.join(','));
}

export function decline(c: ConsentState, actor: Actor, at = Date.now()): ConsentState {
  only(actor, 'monitored', 'Declining');
  if (c.status !== 'pending') throw new ConsentError('There is no pending invitation to decline');
  return log({ ...c, status: 'declined', shared: [] }, actor, 'declined', at);
}

/** Monitored person stops sharing one category, or everything (no category = all). */
export function revoke(c: ConsentState, actor: Actor, category?: CategoryId, at = Date.now()): ConsentState {
  only(actor, 'monitored', 'Changing what is shared');
  if (c.status !== 'accepted') throw new ConsentError('Nothing is being shared');
  const shared = category ? c.shared.filter((x) => x !== category) : [];
  const status = shared.length === 0 ? 'revoked' : 'accepted';
  return log({ ...c, status, shared }, actor, category ? 'category_revoked' : 'all_revoked', at, category);
}

/** Monitored person can add a category back while sharing is active. */
export function share(c: ConsentState, actor: Actor, category: CategoryId, at = Date.now()): ConsentState {
  only(actor, 'monitored', 'Changing what is shared');
  if (c.status !== 'accepted') throw new ConsentError('Sharing is not active');
  if (c.shared.includes(category)) return c;
  return log({ ...c, shared: [...c.shared, category] }, actor, 'category_shared', at, category);
}

export const canSeeData = (c: ConsentState) => c.status === 'accepted' && c.shared.length > 0;
