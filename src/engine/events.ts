import type { TrackedEvent } from './types';

/** Event catalogue for the instrumentation preview. Nothing is sent anywhere: events stay in memory. */
export const EVENT_CATALOGUE: { name: string; when: string; props: string[] }[] = [
  { name: 'household_selected', when: 'Family member picks a scenario', props: ['household_id', 'relationship', 'goal'] },
  { name: 'copy_variant_exposed', when: 'Start or invite copy rendered', props: ['variant', 'surface'] },
  { name: 'invite_sent', when: 'Family sends the invitation', props: ['variant', 'invite_attempt'] },
  { name: 'consent_viewed', when: 'Invited person opens the invitation', props: ['variant'] },
  { name: 'consent_accepted', when: 'Invited person accepts', props: ['categories_count', 'categories'] },
  { name: 'consent_declined', when: 'Invited person declines', props: ['invite_attempt'] },
  { name: 'sharing_revoked', when: 'Invited person removes one area or all', props: ['scope', 'categories_remaining', 'days_since_accept'] },
  { name: 'sensor_status_changed', when: 'A simulated sensor changes state', props: ['sensor', 'from', 'to'] },
  { name: 'setup_ready', when: 'Every shared sensor has reported once', props: ['ready_count', 'shared_count', 'minutes_from_accept'] },
  { name: 'first_insight_viewed', when: 'Today screen rendered after consent', props: ['status', 'coverage_pct', 'data_age_bucket'] },
  { name: 'weekly_summary_viewed', when: 'Weekly screen rendered after consent', props: ['state', 'covered_areas', 'shared_areas'] },
  { name: 'notification_frequency_set', when: 'Family changes digest frequency', props: ['frequency', 'previous'] },
  { name: 'check_in_started', when: 'Family taps a check-in action', props: ['channel', 'weekly_state'] },
  { name: 'insight_feedback', when: 'Family answers "Was this clear?"', props: ['answer', 'status'] },
];

/** Properties that must never appear on an event: identity, location or raw sensor content. */
export const FORBIDDEN_PROPS = ['name', 'email', 'phone', 'address', 'postcode', 'lat', 'lng', 'raw_events', 'free_text'];

export function makeEvent(name: string, props: Record<string, string | number | boolean>, base: Record<string, string | number | boolean>): TrackedEvent {
  for (const k of Object.keys(props)) if (FORBIDDEN_PROPS.includes(k)) throw new Error(`Forbidden event property: ${k}`);
  if (!EVENT_CATALOGUE.some((e) => e.name === name)) throw new Error(`Unknown event: ${name}`);
  return { name, props: { ...base, ...props, synthetic: true } };
}

export const ageBucket = (mins: number | null) =>
  mins === null ? 'none' : mins < 60 ? '<1h' : mins < 360 ? '1-6h' : mins < 1440 ? '6-24h' : '>24h';
