import '@fontsource/dm-serif-display/400.css';
import '@fontsource/epilogue/400.css';
import '@fontsource/epilogue/500.css';
import '@fontsource/epilogue/700.css';
import '@fontsource/oooh-baby/400.css';
import './styles.css';
import { CATEGORIES, GOALS, HOUSEHOLDS, RELATIONSHIPS, SCENARIOS, SENSORS } from './engine/fixtures';
import { accept, ConsentError, decline, revoke, sendInvite, share, canSeeData } from './engine/consent';
import { firstInsight, fmtAge, type CategoryState } from './engine/insight';
import { weeklySummary, FREQUENCIES } from './engine/weekly';
import { EVENT_CATALOGUE, ageBucket } from './engine/events';
import { COPY, HYPOTHESES, SYNTHETIC_FUNNEL } from './engine/lab';
import type { CategoryId, CopyVariant, Frequency, ScenarioId, SensorId, SensorStatus } from './engine/types';
import { freshState, household as householdOf, readiness, requiredSensors, ROUTES, scenario as scenarioOf, track, type AppState, type Route } from './store';

let S: AppState = freshState();
let firstLoad = true;
const app = document.getElementById('app')!;
const household = () => householdOf(S);
const scenario = (_s?: AppState) => scenarioOf(S);

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const goalOf = () => GOALS.find((g) => g.id === S.goal)!;
const relOf = () => RELATIONSHIPS.find((r) => r.id === S.relationship)!;
const you = () => household().you.split(',')[0];

const SENSOR_LABEL: Record<SensorStatus, [string, string, string]> = {
  ready: ['ok', '✓', 'Reporting'],
  lowBattery: ['warn', '!', 'Reporting, low battery'],
  waiting: ['wait', '◔', 'Waiting for first event'],
  notPaired: ['bad', '✕', 'Not paired'],
  offline: ['bad', '✕', 'Offline'],
};
const CAT_LABEL: Record<CategoryState, [string, string, string]> = {
  reporting: ['ok', '✓', 'Reporting'],
  quiet: ['ok', '○', 'Reporting, quiet'],
  missing: ['bad', '?', 'No data'],
  stale: ['warn', '!', 'Stale'],
  notShared: ['off', '–', 'Not shared'],
};
const pill = ([tone, icon, text]: [string, string, string]) => `<span class="pill pill-${tone}"><span aria-hidden="true">${icon}</span> ${esc(text)}</span>`;
const synth = '<span class="synth" title="Synthetic: not Lilli data">synthetic</span>';

function go(route: Route) {
  location.hash = `#/${route}`;
}

function onRoute() {
  const r = (location.hash.replace(/^#\//, '') || 'start') as Route;
  S.route = ROUTES.some((x) => x.id === r) ? r : 'start';
  S.notice = null;
  S.error = null;
  if (S.route === 'today' && canSeeData(S.consent)) {
    const ins = firstInsight(scenario(S), S.consent, S.sensors);
    const fresh = Math.min(...ins.readings.filter((x) => x.state !== 'notShared').map((x) => x.lastEventMins ?? Infinity));
    track(S, 'first_insight_viewed', { status: ins.status, coverage_pct: ins.coverage.pct, data_age_bucket: ageBucket(Number.isFinite(fresh) ? fresh : null) });
  }
  if (S.route === 'week' && canSeeData(S.consent)) {
    const w = weeklySummary(scenario(S), S.consent, S.sensors);
    track(S, 'weekly_summary_viewed', { state: w.state, covered_areas: w.coverageDays.covered, shared_areas: w.coverageDays.total });
  }
  if (S.route === 'start' || S.route === 'consent') track(S, 'copy_variant_exposed', { surface: S.route });
  render(true);
}

/* ---------- views ---------- */

function startView() {
  const c = COPY[S.variant];
  const sc = scenario(S);
  return `
  <section class="hero band-lemon">
    <p class="eyebrow">Step 1 of 5 · Choose a fictional household</p>
    <h1 tabindex="-1"><span class="script">${S.variant === 'benefitFirst' ? 'See' : 'Set up'}</span> ${esc(c.startTitle.replace(/^(See|Let's get)\s*/, S.variant === 'benefitFirst' ? '' : 'your kit '))}</h1>
    <p class="lead">${esc(c.startBody)}</p>
  </section>
  <form class="stack" id="start-form" aria-describedby="sim-note">
    <fieldset class="card">
      <legend>Household <span class="tag">fictional</span></legend>
      ${HOUSEHOLDS.map((h) => `
        <label class="choice">
          <input type="radio" name="household" value="${h.id}" ${h.id === S.householdId ? 'checked' : ''} />
          <span><strong>${esc(h.label)}</strong><br />${esc(h.person)}, ${h.age}. ${esc(h.living)}. You are ${esc(h.you)}.</span>
        </label>`).join('')}
    </fieldset>
    <fieldset class="card">
      <legend>Your relationship</legend>
      <label class="field">Relationship to ${esc(household().person)}
        <select id="relationship" name="relationship">
          ${RELATIONSHIPS.map((r) => `<option value="${r.id}" ${r.id === S.relationship ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
        </select>
      </label>
    </fieldset>
    <fieldset class="card">
      <legend>What would help most?</legend>
      ${GOALS.map((g) => `
        <label class="choice">
          <input type="radio" name="goal" value="${g.id}" ${g.id === S.goal ? 'checked' : ''} />
          <span><strong>${esc(g.label)}</strong>${S.variant === 'benefitFirst' ? `<br /><span class="muted">You'd get: ${esc(g.benefit)}</span>` : ''}</span>
        </label>`).join('')}
    </fieldset>
    <details class="card band-sky" id="sim-note" open>
      <summary>What's simulated here</summary>
      <ul class="tight">
        <li>The people, homes and every sensor event are made up. No real household or Lilli account is involved.</li>
        <li>Sensors mirror the kit on Lilli's public page: kettle plug, fridge door, front door, bedroom and hallway motion, bathroom sensor and hub.</li>
        <li>Current scenario: <strong>${esc(sc.label)}</strong>. ${esc(sc.summary)} Change it below or in the Lab.</li>
        <li>Nothing leaves your browser. Events in the Lab are an in-memory preview.</li>
      </ul>
      <label class="field">Simulated week
        <select id="scenario" name="scenario">${scenarioOptions()}</select>
      </label>
    </details>
    <button class="btn btn-primary" type="submit">Continue to consent <span aria-hidden="true">⟶</span></button>
  </form>`;
}

const scenarioOptions = () => Object.values(SCENARIOS).map((x) => `<option value="${x.id}" ${x.id === S.scenarioId ? 'selected' : ''}>${esc(x.label)}</option>`).join('');

function consentFamilyView() {
  const hh = household();
  const c = S.consent;
  const statusPill: Record<string, [string, string, string]> = {
    notInvited: ['off', '–', 'Not invited yet'],
    pending: ['wait', '◔', 'Pending: waiting for their answer'],
    accepted: ['ok', '✓', 'Accepted'],
    declined: ['bad', '✕', 'Declined'],
    revoked: ['bad', '✕', 'Sharing turned off'],
  };
  let body = '';
  if (c.status === 'notInvited') {
    body = `
      <p>${esc(COPY[S.variant].inviteLead)}</p>
      <div class="card">
        <h2>${esc(hh.person)} will be asked about each of these, one by one</h2>
        <ul class="cats">${CATEGORIES.map((k) => `<li><strong>${esc(k.label)}</strong>: ${esc(k.plain)}</li>`).join('')}</ul>
        <p class="muted">Never collected: video, sound, wearables, location outside the home, or what happens in the bathroom.</p>
      </div>
      <button class="btn btn-primary" id="send-invite">Send invitation to ${esc(hh.person)} <span aria-hidden="true">⟶</span></button>`;
  } else if (c.status === 'pending') {
    body = `
      <div class="card band-warn" role="status">
        <h2>Waiting for ${esc(hh.person)}</h2>
        <p>Nothing is collected or shown until ${esc(hh.person)} says yes. You can't answer on their behalf.</p>
      </div>
      <button class="btn btn-outline" id="as-monitored">Open the invitation as ${esc(hh.person)} (simulated) <span aria-hidden="true">⟶</span></button>`;
  } else if (c.status === 'accepted') {
    body = `
      <div class="card band-ok" role="status">
        <h2>${esc(hh.person)} said yes to ${c.shared.length} of ${CATEGORIES.length} areas</h2>
        <ul class="cats">${CATEGORIES.map((k) => `<li>${esc(k.label)}: ${c.shared.includes(k.id) ? pill(['ok', '✓', 'Shared']) : pill(['off', '–', 'Not shared'])}</li>`).join('')}</ul>
        <p class="muted">${esc(hh.person)} can change this at any time. You'll see "Not shared" if they do.</p>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="to-setup">Continue to setup <span aria-hidden="true">⟶</span></button>
        <button class="btn btn-outline" id="as-monitored">Open ${esc(hh.person)}'s sharing settings (simulated)</button>
      </div>`;
  } else {
    const declined = c.status === 'declined';
    body = `
      <div class="card band-bad" role="status">
        <h2>${declined ? `${esc(hh.person)} said no` : `${esc(hh.person)} turned sharing off`}</h2>
        <p>${declined ? 'That is their decision.' : 'Insights are hidden from you, including earlier ones.'} Nothing is being collected. A conversation together may help more than another invitation.</p>
      </div>
      <button class="btn btn-outline" id="send-invite">Ask again with a new invitation</button>
      <p class="muted small">A new invitation only asks again. ${esc(hh.person)} still decides.</p>`;
  }
  return `
  <p class="eyebrow">Step 2 of 5 · Consent comes first</p>
  <h1 tabindex="-1">Invite <span class="script">${esc(hh.person)}</span></h1>
  <p>${pill(statusPill[c.status])}</p>
  ${body}
  <details class="card">
    <summary>What if ${esc(hh.person)} can't decide for themselves?</summary>
    <p>This concept doesn't let anyone consent on another person's behalf. That route needs legal and safeguarding design (for example lasting power of attorney) and is out of scope here.</p>
  </details>`;
}

function consentMonitoredView() {
  const hh = household();
  const c = S.consent;
  const name = you();
  if (c.status === 'pending') {
    return `
    <div class="as-banner" role="note"><span>Viewing as <strong>${esc(hh.person)}</strong> (simulated)</span> <button class="link" id="as-family">Back to ${esc(name)}'s view</button></div>
    <h1 tabindex="-1">${esc(name)} has asked to see parts of your routine</h1>
    <p class="lead">You decide what to share. You can say no, and you can change your mind at any time.</p>
    <form id="consent-form" class="stack" novalidate>
      <fieldset class="card">
        <legend>Choose what ${esc(name)} can see</legend>
        ${CATEGORIES.map((k) => `
          <label class="choice">
            <input type="checkbox" name="share" value="${k.id}" ${S.draftShare.includes(k.id) ? 'checked' : ''} />
            <span><strong>${esc(k.label)}</strong><br /><span class="muted">${esc(k.plain)}</span></span>
          </label>`).join('')}
      </fieldset>
      <p class="muted">${esc(name)} will never see video or hear sound, as there are no cameras or microphones. They won't see your location outside home either.</p>
      ${S.error ? `<p class="error" role="alert" id="consent-error">${esc(S.error)}</p>` : ''}
      <div class="row">
        <button class="btn btn-primary" type="submit" ${S.error ? 'aria-describedby="consent-error"' : ''}>Share what I've chosen</button>
        <button class="btn btn-outline" type="button" id="decline">No, don't share anything</button>
      </div>
      <button class="link" type="button" id="later">Decide later (nothing is shared meanwhile)</button>
    </form>`;
  }
  if (c.status === 'accepted') {
    return `
    <div class="as-banner" role="note"><span>Viewing as <strong>${esc(hh.person)}</strong> (simulated)</span> <button class="link" id="as-family">Back to ${esc(name)}'s view</button></div>
    <h1 tabindex="-1">Your sharing</h1>
    <p>Turning something off takes effect straight away. ${esc(name)} sees "Not shared".</p>
    <ul class="card list">
      ${CATEGORIES.map((k) => `
        <li class="list-row">
          <span><strong>${esc(k.label)}</strong><br />${c.shared.includes(k.id) ? pill(['ok', '✓', 'Shared']) : pill(['off', '–', 'Not shared'])}</span>
          ${c.shared.includes(k.id)
            ? `<button class="btn btn-small btn-outline" data-revoke="${k.id}">Stop sharing ${esc(k.label.toLowerCase())}</button>`
            : `<button class="btn btn-small btn-outline" data-share="${k.id}">Share ${esc(k.label.toLowerCase())}</button>`}
        </li>`).join('')}
    </ul>
    <button class="btn btn-danger" id="revoke-all">Stop sharing everything</button>`;
  }
  return `
    <div class="as-banner" role="note"><span>Viewing as <strong>${esc(hh.person)}</strong> (simulated)</span> <button class="link" id="as-family">Back to ${esc(name)}'s view</button></div>
    <h1 tabindex="-1">Nothing is being shared</h1>
    <p>${c.status === 'declined' ? 'You said no. ' + esc(name) + ' has been told.' : 'There is no active invitation.'}</p>`;
}

function setupView() {
  const hh = household();
  const accepted = S.consent.status === 'accepted';
  const req = requiredSensors(S);
  const r = readiness(S);
  return `
  <p class="eyebrow">Step 3 of 5 · Setup</p>
  <h1 tabindex="-1">Set up the <span class="script">sensors</span></h1>
  ${!accepted ? `<div class="card band-warn" role="status"><h2>Paused until ${esc(hh.person)} says yes</h2><p>You can read the checklist, but no sensor records anything until consent is given. <a href="#/consent">Go to consent</a></p></div>` : ''}
  <div class="card ${r.complete ? 'band-ok' : 'band-sky'}" role="status" aria-live="polite">
    <h2>${accepted ? `${r.ready} of ${r.total} needed sensors reporting` : 'Readiness not started'}</h2>
    <p>${accepted ? (r.complete ? 'Setup is ready. Your first insight arrives after one full day of data.' : 'A sensor that hasn\'t reported is shown as missing. Missing never counts as "all fine".') : 'Readiness counts only the hub and sensors for areas that have been shared.'}</p>
    <p class="muted small">Lilli's public page quotes an average of 30 minutes for self-setup. Times here are simulated.</p>
  </div>
  <ol class="card list checklist">
    ${SENSORS.map((x) => {
      const needed = req.includes(x.id);
      const st = S.sensors[x.id];
      const label: [string, string, string] = !accepted ? ['off', '–', 'Paused'] : !needed ? ['off', '–', 'Not shared, not needed'] : SENSOR_LABEL[st];
      return `<li class="list-row">
        <span><strong>${esc(x.label)}</strong><br /><span class="muted small">${esc(x.place)}</span></span>
        <span class="right">${pill(label)}${accepted && needed ? sensorAction(x.id, st) : ''}</span>
      </li>`;
    }).join('')}
  </ol>
  <button class="btn btn-primary" id="to-today" ${accepted ? '' : 'disabled aria-disabled="true"'}>See the first insight <span aria-hidden="true">⟶</span></button>`;
}

function sensorAction(id: SensorId, st: SensorStatus) {
  if (st === 'notPaired') return `<button class="btn btn-small btn-outline" data-pair="${id}">Pair (simulated)</button>`;
  if (st === 'waiting') return `<button class="btn btn-small btn-outline" data-test="${id}">Send test event (simulated)</button>`;
  if (st === 'offline') return `<span class="muted small hint">Check it's plugged in or the battery is in. Switch scenario to see other states.</span>`;
  return '';
}

function personCircle(status: string) {
  const hh = household();
  return `<div class="person" aria-hidden="true"><svg viewBox="0 0 48 48" width="56" height="56"><path d="M8 22 24 9l16 13v17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2Z" fill="none" stroke="#0d3f40" stroke-width="3" stroke-linejoin="round"/>${status === 'ready' ? '<path d="M18 28c2 3 10 3 12 0" stroke="#0d3f40" stroke-width="3" fill="none" stroke-linecap="round"/>' : '<path d="M18 30h12" stroke="#0d3f40" stroke-width="3" stroke-linecap="round"/>'}</svg><span>${esc(hh.person)}</span></div>`;
}

function todayView() {
  const ins = firstInsight(scenario(S), S.consent, S.sensors);
  const tone = ins.status === 'ready' ? 'ok' : ins.status === 'noConsent' || ins.status === 'revoked' ? 'bad' : 'warn';
  const locked = ins.status === 'noConsent' || ins.status === 'revoked';
  return `
  <p class="eyebrow">Step 4 of 5 · First useful insight ${synth}</p>
  <h1 tabindex="-1"><span class="script">Today</span> with ${esc(household().person)}</h1>
  <div class="app-card">
    <div class="app-top">${personCircle(ins.status)}<div><p class="status-word" data-status="${ins.status}">${pill([tone, tone === 'ok' ? '✓' : '!', statusLabel(ins.status)])}</p><p class="small muted">${esc(ins.freshness)}</p></div></div>
    <h2>${esc(ins.headline)}</h2>
    <p>${esc(ins.body)}</p>
    ${locked ? `<a class="btn btn-outline" href="#/consent">Go to consent</a>` : `
    <dl class="facts">
      <div><dt>Freshness</dt><dd>${esc(ins.freshness)}</dd></div>
      <div><dt>Coverage</dt><dd>${ins.coverage.reporting} of ${ins.coverage.shared} shared sensors (${ins.coverage.pct}%)</dd></div>
    </dl>`}
  </div>
  ${locked ? '' : `
  <div class="date-band"><span>Last day · simulated clock</span></div>
  <ul class="list readings">
    ${ins.readings.map((r) => `<li class="reading" data-cat="${r.id}" data-state="${r.state}"><div><strong>${esc(r.label)}</strong> ${pill(CAT_LABEL[r.state])}</div><p>${esc(r.sentence)}</p></li>`).join('')}
  </ul>
  <div class="card band-sky">
    <h2>How sure is this?</h2>
    <ul class="tight">${ins.uncertainty.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>
  </div>
  <fieldset class="card feedback">
    <legend>Was this clear?</legend>
    <div class="row">
      <button class="btn btn-small btn-outline" data-feedback="clear" aria-pressed="${S.feedback === 'clear'}">Yes, clear</button>
      <button class="btn btn-small btn-outline" data-feedback="unclear" aria-pressed="${S.feedback === 'unclear'}">Not really</button>
    </div>
    ${S.feedback ? `<p role="status" class="small">Thanks. Recorded as an in-memory event only.</p>` : ''}
  </fieldset>
  <button class="btn btn-primary" id="to-week">See the weekly summary <span aria-hidden="true">⟶</span></button>`}`;
}

const statusLabel = (s: string) => ({ ready: 'Insight ready', tooEarly: 'Too early', stale: 'Data is stale', insufficient: 'Not enough data', noConsent: 'No consent', revoked: 'Sharing off' } as Record<string, string>)[s];

function bars(series: (number | null)[], label: string) {
  const max = Math.max(1, ...series.map((x) => x ?? 0));
  const w = 18;
  const days = series.map((v, i) => {
    const x = i * (w + 6);
    if (v === null) return `<rect x="${x}" y="2" width="${w}" height="38" rx="4" class="nodata"/><text x="${x + w / 2}" y="26" text-anchor="middle" class="nd">?</text>`;
    const h = Math.max(3, (v / max) * 38);
    return `<rect x="${x}" y="${40 - h}" width="${w}" height="${h}" rx="4" class="${i >= 4 ? 'recent' : 'earlier'}"/>`;
  }).join('');
  const desc = series.map((v, i) => `day ${i + 1}: ${v === null ? 'no data' : v}`).join(', ');
  return `<svg class="bars" viewBox="0 0 ${7 * (w + 6)} 42" role="img" aria-label="${esc(label)} per day, ${esc(desc)}">${days}</svg>`;
}

function weekView() {
  const w = weeklySummary(scenario(S), S.consent, S.sensors);
  const tone = w.state === 'stable' ? 'ok' : w.state === 'locked' ? 'bad' : 'warn';
  const stateText = ({ locked: 'No consent', forming: 'Baseline forming', stable: 'Stable pattern', changed: 'Changed pattern', insufficient: 'Insufficient coverage' } as const)[w.state];
  return `
  <p class="eyebrow">Step 5 of 5 · Weekly family summary ${synth}</p>
  <h1 tabindex="-1">${esc(household().person)}'s <span class="script">week</span></h1>
  <div class="app-card" data-weekly="${w.state}">
    <p>${pill([tone, tone === 'ok' ? '✓' : '!', stateText])}</p>
    <h2>${esc(w.headline)}</h2>
    <p>${esc(w.body)}</p>
    ${w.state === 'locked' ? '<a class="btn btn-outline" href="#/consent">Go to consent</a>' : `<p class="small muted">Coverage: ${w.coverageDays.covered} of ${w.coverageDays.total} shared areas had data on 5+ of 7 days.</p>`}
  </div>
  ${w.state === 'locked' ? '' : `
  ${w.trends.length ? `<ul class="list trends">${w.trends.map((t) => `
    <li class="trend" data-dir="${t.direction}">
      <div class="trend-head"><strong>${esc(t.label)}</strong>${t.direction === 'unknown' ? pill(['bad', '?', 'Too little data']) : t.direction === 'same' ? pill(['ok', '=', 'Similar']) : pill(['warn', t.direction === 'more' ? '↑' : '↓', t.direction === 'more' ? 'More than earlier' : 'Less than earlier'])}</div>
      ${bars(t.series, t.label)}
      <p class="small">${esc(t.sentence)}</p>
    </li>`).join('')}</ul>
    <p class="small muted legend"><span class="key earlier"></span> days 1–4 <span class="key recent"></span> days 5–7 <span class="key nodata"></span> no data (?)</p>` : ''}
  ${w.checkInPrompt ? `<div class="card band-sky"><h2>Suggested next step</h2><p>${esc(w.checkInPrompt)}</p></div>` : ''}
  <fieldset class="card">
    <legend>Check in with ${esc(household().person)}</legend>
    <div class="row">
      ${['Call', 'Send a message', 'Mark as checked in'].map((c) => `<button class="btn btn-small btn-outline" data-checkin="${c}">${c}</button>`).join('')}
    </div>
    <div aria-live="polite">${S.checkIns.length ? `<p class="small" role="status">Noted: ${esc(S.checkIns.at(-1)!)}. Nothing was actually sent; this is a prototype.</p>` : ''}</div>
  </fieldset>
  <fieldset class="card" id="freq">
    <legend>How often should we tell you?</legend>
    ${FREQUENCIES.map((f) => `
      <label class="choice"><input type="radio" name="frequency" value="${f.id}" ${S.frequency === f.id ? 'checked' : ''} /><span><strong>${esc(f.label)}</strong><br /><span class="muted small">${esc(f.detail)}</span></span></label>`).join('')}
    <p class="small muted">No instant alerts. Lilli says publicly that it does not currently detect falls, so a real-time ping could be mistaken for an emergency service. ${esc(household().person)} can see which option you chose.</p>
  </fieldset>`}`;
}

function labView() {
  const max = SYNTHETIC_FUNNEL[0].count;
  return `
  <p class="eyebrow">Product lab · for discussion</p>
  <h1 tabindex="-1">Product <span class="script">lab</span></h1>
  <div class="card band-warn" role="note"><strong>Every number on this page is synthetic.</strong> None of it is Lilli performance data, research or a forecast.</div>
  <section class="card">
    <h2>Hypotheses</h2>
    <ol class="tight">${HYPOTHESES.map((h) => `<li><strong>${h.id} ${esc(h.title)}</strong> <span class="tag">${esc(h.status)}</span><br />${esc(h.statement)}</li>`).join('')}</ol>
  </section>
  <fieldset class="card">
    <legend>Onboarding copy variant</legend>
    ${(Object.keys(COPY) as CopyVariant[]).map((k) => `<label class="choice"><input type="radio" name="variant" value="${k}" ${S.variant === k ? 'checked' : ''}/><span><strong>${esc(COPY[k].label)}</strong><br /><span class="muted small">"${esc(COPY[k].startTitle)}": ${esc(COPY[k].startBody)}</span></span></label>`).join('')}
    <p class="small muted">Changes the Start and Invite screens. The variant is attached to every event.</p>
  </fieldset>
  <fieldset class="card">
    <legend>Scenario</legend>
    <label class="field">Simulated week<select id="scenario-lab">${scenarioOptions()}</select></label>
  </fieldset>
  <section class="card">
    <h2>Simulated funnel ${synth}</h2>
    <p class="small muted">Illustrative cohort of 1,000 made-up households to show stage denominators. Variants are not compared: there is no real data to compare.</p>
    <ol class="funnel">${SYNTHETIC_FUNNEL.map((f, i) => `
      <li><div class="funnel-label"><span>${esc(f.step)}</span><span><strong>${f.count.toLocaleString('en-GB')}</strong> ${synth}</span></div>
      <div class="funnel-bar" style="width:${(f.count / max) * 100}%"></div>
      <span class="small muted">Denominator: ${esc(f.denominator)}${i ? ` · step rate ${Math.round((f.count / SYNTHETIC_FUNNEL[i - 1].count) * 100)}% (synthetic)` : ''}</span></li>`).join('')}</ol>
  </section>
  <section class="card">
    <h2>Event instrumentation preview</h2>
    <p class="small muted">Events this session (newest first). Kept in memory; nothing is sent. No names, contact details or raw sensor events are allowed as properties.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Session events"><table>
      <thead><tr><th scope="col">#</th><th scope="col">Event</th><th scope="col">Properties</th></tr></thead>
      <tbody>${S.events.slice().reverse().slice(0, 25).map((e) => `<tr><td>${e.props.seq}</td><td><code>${esc(e.name)}</code></td><td><code>${esc(JSON.stringify(e.props))}</code></td></tr>`).join('') || '<tr><td colspan="3">No events yet</td></tr>'}</tbody>
    </table></div>
    <details><summary>Full event catalogue (${EVENT_CATALOGUE.length})</summary>
      <ul class="tight small">${EVENT_CATALOGUE.map((e) => `<li><code>${e.name}</code>: ${esc(e.when)}. Props: ${e.props.map((p) => `<code>${p}</code>`).join(', ')}</li>`).join('')}</ul>
    </details>
  </section>
  <button class="btn btn-outline" id="reset">Reset the demo</button>`;
}

function rail() {
  const hh = household();
  const sc = scenario(S);
  return `
  <aside class="rail" aria-label="About this concept">
    <div class="card band-blush">
      <p class="eyebrow">Independent concept</p>
      <p>A product idea for the first week of a family plan: consent first, then setup, then one honest, useful insight. Not a Lilli product.</p>
    </div>
    <div class="card">
      <h2 class="h3">Right now</h2>
      <dl class="facts">
        <div><dt>Household</dt><dd>${esc(hh.label)}</dd></div>
        <div><dt>You</dt><dd>${esc(relOf().label)}</dd></div>
        <div><dt>Goal</dt><dd>${esc(goalOf().label)}</dd></div>
        <div><dt>Consent</dt><dd data-testid="rail-consent">${esc(S.consent.status)}${S.consent.status === 'accepted' ? ` (${S.consent.shared.length} areas)` : ''}</dd></div>
        <div><dt>Scenario</dt><dd>${esc(sc.label)}</dd></div>
        <div><dt>Copy</dt><dd>${esc(COPY[S.variant].label)}</dd></div>
      </dl>
    </div>
    <div class="card band-sky small">
      <p><strong>Simulated:</strong> people, homes, sensor events, clock and funnel. <strong>Real:</strong> the sensor types (from Lilli's public family page) and the logo and colours (from Lilli's public site).</p>
      <p>Lilli's family product is on a waiting list, so I couldn't try it. Nothing here describes how it actually works.</p>
    </div>
  </aside>`;
}

function render(routeChanged = false) {
  const active = document.activeElement as HTMLElement | null;
  const activeKey = active?.id || (active?.dataset && Object.entries(active.dataset).map(([k, v]) => `[data-${k}="${v}"]`)[0]) || (active instanceof HTMLInputElement ? `input[name="${active.name}"][value="${active.value}"]` : null);
  const view = { start: startView, consent: S.view === 'monitored' ? consentMonitoredView : consentFamilyView, setup: setupView, today: todayView, week: weekView, lab: labView }[S.route]();
  app.innerHTML = `
  <a class="skip" href="#main">Skip to content</a>
  <header class="top">
    <a class="brand" href="#/start" aria-label="Family First-Week Lab, start"><img src="/brand/lilli-logo.svg" alt="Lilli logo" width="40" height="31" /><span>Family First-Week Lab</span></a>
    <span class="concept-badge"><span class="wide">Independent </span>concept · not Lilli</span>
  </header>
  <div class="layout">
    <main id="main" class="phone ${S.view === 'monitored' ? 'is-monitored' : ''}" data-route="${S.route}">
      ${S.notice ? `<p class="notice" role="status">${esc(S.notice)}</p>` : ''}
      ${view}
    </main>
    ${rail()}
  </div>
  <nav class="steps" aria-label="Steps">
    <ol>${ROUTES.map((r) => `<li><a href="#/${r.id}" ${S.route === r.id ? 'aria-current="page"' : ''}>${r.step ? `<span class="n" aria-hidden="true">${r.step}</span>` : '<span class="n" aria-hidden="true">✦</span>'}<span>${r.label}</span></a></li>`).join('')}</ol>
  </nav>
  <footer class="foot">
    <p><strong>Independent concept by Ayo Ahmed</strong></p>
    <p>Not affiliated with, endorsed by or built for Intelligent Lilli. The Lilli name and logo belong to their owner and are used here only to illustrate a product idea. All people, homes, sensor data and numbers are synthetic. Not a medical or safety service. <a href="/brand-guide.html">Brand guide</a></p>
  </footer>`;
  if (routeChanged && !firstLoad) {
    (app.querySelector('h1') as HTMLElement | null)?.focus();
    window.scrollTo(0, 0);
  } else if (activeKey) {
    const el = (document.getElementById(activeKey) || app.querySelector(activeKey)) as HTMLElement | null;
    if (el) el.focus();
    else (app.querySelector('h1') as HTMLElement | null)?.focus();
  }
}

/* ---------- actions ---------- */

function setScenario(id: ScenarioId) {
  S.scenarioId = id;
  S.sensors = { ...SCENARIOS[id].sensors };
}

function act(fn: () => void, focusTop = false) {
  try {
    S.error = null;
    fn();
  } catch (e) {
    if (e instanceof ConsentError) S.error = e.message;
    else throw e;
  }
  render(focusTop);
}

app.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.name === 'household') act(() => {
    const hh = HOUSEHOLDS.find((h) => h.id === t.value)!;
    const fresh = freshState();
    S = { ...fresh, route: S.route, variant: S.variant, events: S.events, clock: S.clock, householdId: hh.id, relationship: hh.defaultRelationship, goal: hh.defaultGoal };
    setScenario(hh.defaultScenario);
  });
  else if (t.name === 'relationship') act(() => { S.relationship = t.value; });
  else if (t.name === 'goal') act(() => { S.goal = t.value; });
  else if (t.id === 'scenario' || t.id === 'scenario-lab') act(() => setScenario(t.value as ScenarioId));
  else if (t.name === 'share') {
    const v = t.value as CategoryId;
    S.draftShare = t.checked ? [...S.draftShare, v] : S.draftShare.filter((x) => x !== v);
  } else if (t.name === 'frequency') act(() => {
    const prev = S.frequency;
    S.frequency = t.value as Frequency;
    track(S, 'notification_frequency_set', { frequency: S.frequency, previous: prev });
  });
  else if (t.name === 'variant') act(() => { S.variant = t.value as CopyVariant; });
});

app.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  if (f.id === 'start-form') {
    track(S, 'household_selected', { relationship: S.relationship, goal: S.goal });
    go('consent');
  } else if (f.id === 'consent-form') {
    act(() => {
      S.consent = accept(S.consent, 'monitored', S.draftShare, S.clock);
      track(S, 'consent_accepted', { categories_count: S.consent.shared.length, categories: S.consent.shared.join('|') });
      S.view = 'family';
      S.notice = `${household().person} accepted (simulated).`;
    }, true);
  }
});

app.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!b || b.disabled) return;
  const d = b.dataset;
  const id = b.id;
  if (id === 'send-invite') act(() => {
    S.consent = sendInvite(S.consent, 'family', S.clock);
    S.inviteAttempts += 1;
    S.draftShare = [];
    track(S, 'invite_sent', { invite_attempt: S.inviteAttempts });
  }, true);
  else if (id === 'as-monitored') act(() => {
    S.view = 'monitored';
    if (S.consent.status === 'pending') track(S, 'consent_viewed');
  }, true);
  else if (id === 'as-family' || id === 'later') act(() => { S.view = 'family'; }, true);
  else if (id === 'decline') act(() => {
    S.consent = decline(S.consent, 'monitored', S.clock);
    track(S, 'consent_declined', { invite_attempt: S.inviteAttempts });
    S.view = 'family';
    S.notice = `${household().person} declined (simulated).`;
  }, true);
  else if (d.revoke) act(() => {
    S.consent = revoke(S.consent, 'monitored', d.revoke as CategoryId, S.clock);
    track(S, 'sharing_revoked', { scope: 'category', categories_remaining: S.consent.shared.length, days_since_accept: scenario(S).daysElapsed });
    if (S.consent.status === 'revoked') { S.view = 'family'; S.notice = 'All sharing is off (simulated).'; }
  }, S.consent.shared.length <= 1);
  else if (d.share) act(() => { S.consent = share(S.consent, 'monitored', d.share as CategoryId, S.clock); });
  else if (id === 'revoke-all') act(() => {
    S.consent = revoke(S.consent, 'monitored', undefined, S.clock);
    track(S, 'sharing_revoked', { scope: 'all', categories_remaining: 0, days_since_accept: scenario(S).daysElapsed });
    S.view = 'family';
    S.notice = 'All sharing is off (simulated).';
  }, true);
  else if (id === 'to-setup') go('setup');
  else if (id === 'to-today') go('today');
  else if (id === 'to-week') go('week');
  else if (d.pair || d.test) act(() => {
    const sid = (d.pair || d.test) as SensorId;
    const from = S.sensors[sid];
    S.sensors[sid] = d.pair ? 'waiting' : 'ready';
    track(S, 'sensor_status_changed', { sensor: sid, from, to: S.sensors[sid] });
    if (readiness(S).complete) track(S, 'setup_ready', { ready_count: readiness(S).ready, shared_count: readiness(S).total, minutes_from_accept: 0 });
  });
  else if (d.feedback) act(() => {
    S.feedback = d.feedback!;
    track(S, 'insight_feedback', { answer: d.feedback!, status: firstInsight(scenario(S), S.consent, S.sensors).status });
  });
  else if (d.checkin) act(() => {
    S.checkIns.push(d.checkin!);
    track(S, 'check_in_started', { channel: d.checkin!.toLowerCase().replace(/\s+/g, '_'), weekly_state: weeklySummary(scenario(S), S.consent, S.sensors).state });
  });
  else if (id === 'reset') { S = freshState(); go('start'); onRoute(); }
});

window.addEventListener('hashchange', onRoute);
onRoute();
firstLoad = false;

// Exposed for automated checks only; reads state, cannot change consent.
(window as unknown as { __lab: () => unknown }).__lab = () => JSON.parse(JSON.stringify({ route: S.route, consent: S.consent, scenario: S.scenarioId, events: S.events.map((e) => e.name), fmt: fmtAge(5) }));
