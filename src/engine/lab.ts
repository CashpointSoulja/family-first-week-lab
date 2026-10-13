import type { CopyVariant } from './types';

export const HYPOTHESES = [
  {
    id: 'H1',
    title: 'Benefit before effort',
    statement: 'If the family member sees the specific first insight they will get (in their own goal\'s words) before being asked to invite and install, more invitations will be sent and accepted, without more declines caused by pressure.',
    status: 'Untested assumption',
  },
  {
    id: 'H2',
    title: 'Calm default digest',
    statement: 'Defaulting to a weekly digest (with daily and "only when different" as choices) will keep more families returning in week 2 than a daily default, with fewer notification opt-outs.',
    status: 'Untested assumption',
  },
  {
    id: 'H3',
    title: 'Honest gaps build trust',
    statement: 'Saying "no data, this is unknown" instead of hiding gaps will cause fewer misunderstandings and won\'t lower return visits.',
    status: 'Untested assumption',
  },
];

export const COPY: Record<CopyVariant, { label: string; startTitle: string; startBody: string; inviteLead: string }> = {
  setupFirst: {
    label: 'A: setup first (control)',
    startTitle: 'Let\'s get your kit set up',
    startBody: 'Invite your loved one, place six sensors and connect the hub. Insights start once everything is reporting.',
    inviteLead: 'Before we can set up, they need to agree.',
  },
  benefitFirst: {
    label: 'B: benefit first',
    startTitle: 'See what your first week could tell you',
    startBody: 'After one full day you get a short note on whether the usual routine has started, and how sure that note is. It all starts with their yes.',
    inviteLead: 'Here is exactly what they will be asked to share. They choose, and can change their mind any time.',
  },
};

/**
 * Synthetic funnel: an illustrative cohort of 1,000 made-up households, so stage
 * denominators can be discussed. These are not Lilli figures and not predictions.
 */
export const SYNTHETIC_FUNNEL = [
  { step: 'Household selected', metric: 'start', count: 1000, denominator: 'All synthetic households' },
  { step: 'Invitation sent', metric: 'invite_sent', count: 720, denominator: 'Households selected' },
  { step: 'Consent accepted', metric: 'consent_completion', count: 540, denominator: 'Invitations sent (excl. bounced)' },
  { step: 'Setup ready', metric: 'setup_readiness', count: 430, denominator: 'Consents accepted' },
  { step: 'First useful insight', metric: 'first_useful_insight', count: 380, denominator: 'Setups ready for 24h+' },
  { step: 'Weekly summary opened (week 2)', metric: 'weekly_return', count: 260, denominator: 'Reached first insight 7+ days ago' },
];
