import '@fontsource/dm-serif-display/400.css';
import '@fontsource/epilogue/400.css';
import '@fontsource/epilogue/500.css';
import '@fontsource/epilogue/700.css';
import '@fontsource/oooh-baby/400.css';
import './styles.css';
import { CATEGORIES, GOALS, HOUSEHOLDS, RELATIONSHIPS, SCENARIOS, SENSORS } from './engine/fixtures';
import { fmtAge, type CategoryState } from './engine/insight';
import { FREQUENCIES } from './engine/weekly';
import { EVENT_CATALOGUE } from './engine/events';
import { COPY, HYPOTHESES, SYNTHETIC_FUNNEL } from './engine/lab';
import type { CategoryId, CopyVariant, SensorId, SensorStatus } from './engine/types';
import type { CommandType } from './server/commands';
import type { Derived } from './server/model';
import { household as householdOf, placeholderDerived, placeholderState, ROUTES, scenario as scenarioOf, type AppState, type Route } from './store';
import { ApiError, loadState, postCommand, type Snapshot } from './api';

let S: AppState = placeholderState();
let D: Derived = placeholderDerived();
let server: 'loading' | 'ok' | 'down' = 'loading';
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
  if (server === 'ok') S.error = null;
  render(true);
  if (server === 'ok' && (S.route === 'start' || S.route === 'consent' || S.route === 'today' || S.route === 'week')) void run('viewed', { surface: S.route }, { silent: true, background: true });
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
        <li>Your choices are saved in a private lab session on the server, keyed to a random cookie, so a reload keeps them. Nothing goes to Lilli or any analytics service.</li>
      </ul>
      <label class="field">Simulated week
        <select id="scenario" name="scenario">${scenarioOptions()}</select>
      </label>
    </details>
    <button class="btn btn-primary" type="submit">Continue to consent <span aria-hidden="true">⟶</span></button>
  </form>`;
}

const demoRoleNote = `<p class="muted small" id="demo-role-note"><strong>Demo role switch, not sign-in.</strong> Anyone using this prototype can switch roles, so it does not prove who gave consent. The server enforces which role may make each choice; real consent would need the invited person's own verified account.</p>`;

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
      <button class="btn btn-outline" id="as-monitored">Open the invitation as ${esc(hh.person)} (simulated) <span aria-hidden="true">⟶</span></button>
      ${demoRoleNote}`;
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
  const req = D.requiredSensors;
  const r = D.readiness;
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
      return `<li class="list-row" data-sensor="${x.id}" data-sensor-status="${accepted && needed ? st : 'off'}">
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
  const ins = D.insight;
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
    ${S.feedback ? `<p role="status" class="small">Thanks. Recorded as a synthetic event in this lab session only.</p>` : ''}
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
  const w = D.weekly;
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
  <p class="small"><a href="/api/export" id="export-link">Export what you can currently see</a> <span class="muted">(synthetic JSON, built from current consent only)</span></p>
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
    <p class="small muted">Events this session (newest first). Stored in this visitor's private lab session (newest 200 kept); nothing goes to an analytics service. No names, contact details or raw sensor events are allowed as properties.</p>
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
      ${server !== 'ok' ? `<p class="muted" data-testid="rail-unloaded">Not loaded yet. Nothing is shown until the lab server answers.</p>` : `<dl class="facts">
        <div><dt>Household</dt><dd>${esc(hh.label)}</dd></div>
        <div><dt>You</dt><dd>${esc(relOf().label)}</dd></div>
        <div><dt>Goal</dt><dd>${esc(goalOf().label)}</dd></div>
        <div><dt>Consent</dt><dd data-testid="rail-consent">${esc(S.consent.status)}${S.consent.status === 'accepted' ? ` (${S.consent.shared.length} areas)` : ''}</dd></div>
        <div><dt>Scenario</dt><dd>${esc(sc.label)}</dd></div>
        <div><dt>Copy</dt><dd>${esc(COPY[S.variant].label)}</dd></div>
        <div><dt>Saved</dt><dd data-testid="rail-revision">Server revision ${S.revision}</dd></div>
      </dl>`}
    </div>
    <div class="card band-sky small">
      <p><strong>Simulated:</strong> people, homes, sensor events, clock and funnel. <strong>Real:</strong> the sensor types (from Lilli's public family page) and the logo and colours (from Lilli's public site).</p>
      <p>Lilli's family product is on a waiting list, so I couldn't try it. Nothing here describes how it actually works.</p>
    </div>
  </aside>`;
}

function focusKey(): string | null {
  const active = document.activeElement as HTMLElement | null;
  return active?.id || (active?.dataset && Object.entries(active.dataset).map(([k, v]) => `[data-${k}="${v}"]`)[0]) || (active instanceof HTMLInputElement ? `input[name="${active.name}"][value="${active.value}"]` : null);
}

function render(routeChanged = false, restoreKey: string | null = null) {
  const active = document.activeElement as HTMLElement | null;
  const activeKey = restoreKey ?? focusKey();
  const view = server !== 'ok' ? serverView() : { start: startView, consent: S.view === 'monitored' ? consentMonitoredView : consentFamilyView, setup: setupView, today: todayView, week: weekView, lab: labView }[S.route]();
  app.innerHTML = `
  <a class="skip" href="#main">Skip to content</a>
  <header class="top">
    <a class="brand" href="#/start" aria-label="Family First-Week Lab, start"><img src="/brand/lilli-logo.svg" alt="Lilli logo" width="40" height="31" /><span>Family First-Week Lab</span></a>
    <span class="concept-badge"><span class="wide">Independent </span>concept · not Lilli</span>
  </header>
  <div class="layout">
    <main id="main" class="phone ${S.view === 'monitored' ? 'is-monitored' : ''}" data-route="${S.route}" ${pending ? 'aria-busy="true"' : ''}>
      ${pending ? `<p class="pending" role="status" id="api-pending">${esc(pending)}. Buttons are paused until the lab server answers.</p>` : ''}
      ${S.notice ? `<p class="notice" role="status">${esc(S.notice)}</p>` : ''}
      ${S.error && server === 'ok' && !(S.route === 'consent' && S.view === 'monitored') ? `<p class="error" role="alert" id="api-error">${esc(S.error)}</p>` : ''}
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
  if (pending) pauseControls();
  if (pending) document.body.dataset.busy = 'true';
  else delete document.body.dataset.busy;
  if (active?.tagName === 'H1' && !routeChanged) {
    (app.querySelector('h1') as HTMLElement | null)?.focus();
  } else if (routeChanged && !firstLoad) {
    (app.querySelector('h1') as HTMLElement | null)?.focus();
    window.scrollTo(0, 0);
  } else if (activeKey) {
    const el = (document.getElementById(activeKey) || app.querySelector(activeKey)) as HTMLElement | null;
    if (el) el.focus();
    else (app.querySelector('h1') as HTMLElement | null)?.focus();
  }
}

/* ---------- server-backed actions ---------- */

function serverView() {
  if (server === 'loading') return `<p class="eyebrow">Loading</p><h1 tabindex="-1">Opening your <span class="script">lab</span></h1><p role="status">Loading your saved synthetic session from the server.</p>`;
  return `
  <p class="eyebrow">Lab server unavailable</p>
  <h1 tabindex="-1">Nothing to <span class="script">show</span></h1>
  <div class="card band-bad" role="alert"><h2>The lab server could not load your session</h2><p>${esc(S.error ?? 'Try again shortly.')}</p><p>Rather than show stale or made-up readings, the prototype shows nothing until the server answers.</p></div>
  <button class="btn btn-outline" id="retry-load">Try again</button>`;
}

function adopt(snap: Snapshot) {
  S = { ...snap.state, revision: snap.revision, route: S.route, draftShare: S.draftShare, notice: S.notice, error: S.error };
  D = snap.derived;
}

/** Every control that can send a command. Buttons stay focusable (aria-disabled); form fields are disabled outright. */
function pauseControls() {
  app.querySelectorAll<HTMLButtonElement>('.layout button').forEach((b) => b.setAttribute('aria-disabled', 'true'));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.layout input, .layout select').forEach((f) => { f.disabled = true; });
}

/** Pause the controls already on screen (keeping the user's in-progress choice visible) and say why. */
function showPending() {
  const main = app.querySelector('main');
  if (!main || !pending) return;
  main.setAttribute('aria-busy', 'true');
  main.insertAdjacentHTML('afterbegin', `<p class="pending" role="status" id="api-pending">${esc(pending)}. Buttons are paused until the lab server answers.</p>`);
  pauseControls();
  document.body.dataset.busy = 'true';
}

let chain: Promise<unknown> = Promise.resolve();
/** Label of the user command waiting on the server, or null. While set, no other user command can start. */
let pending: string | null = null;

const PENDING_LABEL: Partial<Record<CommandType, string>> = {
  pairSensor: 'Pairing the sensor (simulated)',
  testSensor: 'Sending the test event (simulated)',
  accept: 'Saving the sharing choice',
  decline: 'Saving the decline',
  revoke: 'Turning sharing off',
  share: 'Turning sharing back on',
  reset: 'Resetting the lab',
};

interface RunOpts { focusTop?: boolean; silent?: boolean; background?: boolean; focusAfter?: string; notice?: (s: AppState) => string | null }

/**
 * A user command is single-flight: it renders the paused state before the request leaves, and a second
 * click while it is pending is dropped rather than queued, because the button it came from was drawn from
 * a state the server has not confirmed yet. Background page-view events never pause the UI.
 * Everything still goes through one chain so each request carries the latest revision the server gave us.
 */
function run(type: CommandType, payload: Record<string, unknown> = {}, opts: RunOpts = {}): Promise<boolean> {
  if (!opts.background) {
    if (pending) return Promise.resolve(false);
    pending = PENDING_LABEL[type] ?? 'Saving';
  }
  const restoreKey = opts.background ? null : focusKey();
  if (!opts.background) showPending();
  const p = chain.then(async () => {
    let ok = false;
    try {
      const snap = await postCommand(type, payload, S.revision);
      S.error = null;
      adopt(snap);
      if (opts.notice) S.notice = opts.notice(S);
      ok = true;
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.snapshot) adopt(e.snapshot);
        S.notice = null;
        S.error = e.code === 'stale_revision'
          ? 'This lab changed in another tab or window, so I loaded the latest saved state. Your last action was not applied; check and try again.'
          : e.message;
      } else {
        S.error = 'Could not reach the lab server. Nothing was changed.';
      }
    }
    if (!opts.background) pending = null;
    if (!(opts.background && ok)) render(ok && !opts.silent ? opts.focusTop : false, ok && opts.focusTop ? null : (ok && opts.focusAfter) || restoreKey);
    return ok;
  });
  chain = p.catch(() => false);
  return p;
}

const person = () => household().person;

app.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (server !== 'ok') return;
  if (t.name === 'household') { S.draftShare = []; void run('selectHousehold', { householdId: t.value }); }
  else if (t.name === 'relationship') void run('setRelationship', { relationship: t.value });
  else if (t.name === 'goal') void run('setGoal', { goal: t.value });
  else if (t.id === 'scenario' || t.id === 'scenario-lab') void run('setScenario', { scenarioId: t.value });
  else if (t.name === 'share') {
    const v = t.value as CategoryId;
    S.draftShare = t.checked ? [...S.draftShare, v] : S.draftShare.filter((x) => x !== v);
  } else if (t.name === 'frequency') void run('setFrequency', { frequency: t.value });
  else if (t.name === 'variant') void run('setVariant', { variant: t.value });
});

app.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  if (server !== 'ok') return;
  if (f.id === 'start-form') void run('confirmStart', {}, { silent: true }).then((ok) => ok && go('consent'));
  else if (f.id === 'consent-form') void run('accept', { categories: S.draftShare }, { focusTop: true, notice: () => `${person()} accepted (simulated).` });
});

app.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
  const d = b.dataset;
  const id = b.id;
  if (id === 'retry-load') { void boot(); return; }
  if (server !== 'ok') return;
  if (id === 'send-invite') { S.draftShare = []; void run('sendInvite', {}, { focusTop: true }); }
  else if (id === 'as-monitored') void run('switchActor', { actor: 'monitored' }, { focusTop: true });
  else if (id === 'as-family' || id === 'later') void run('switchActor', { actor: 'family' }, { focusTop: true });
  else if (id === 'decline') void run('decline', {}, { focusTop: true, notice: () => `${person()} declined (simulated).` });
  else if (d.revoke) void run('revoke', { category: d.revoke }, { focusTop: S.consent.shared.length <= 1, notice: (s) => (s.consent.status === 'revoked' ? 'All sharing is off (simulated).' : null) });
  else if (d.share) void run('share', { category: d.share });
  else if (id === 'revoke-all') void run('revoke', {}, { focusTop: true, notice: () => 'All sharing is off (simulated).' });
  else if (id === 'to-setup') go('setup');
  else if (id === 'to-today') go('today');
  else if (id === 'to-week') go('week');
  else if (d.pair) void run('pairSensor', { sensor: d.pair as SensorId }, { focusAfter: `[data-test="${d.pair}"]` });
  else if (d.test) void run('testSensor', { sensor: d.test as SensorId });
  else if (d.feedback) void run('feedback', { answer: d.feedback });
  else if (d.checkin) void run('checkIn', { channel: d.checkin });
  else if (id === 'reset') {
    S.draftShare = [];
    void run('reset', {}, { silent: true }).then((ok) => {
      if (!ok) return;
      if (location.hash === '#/start' || location.hash === '') onRoute();
      else go('start');
    });
  }
});

async function boot() {
  server = 'loading';
  try {
    adopt(await loadState());
    S.error = null;
    server = 'ok';
  } catch (e) {
    server = 'down';
    S.error = e instanceof ApiError ? e.message : 'Could not reach the lab server.';
  }
  onRoute();
  firstLoad = false;
  document.body.dataset.lab = server;
}

window.addEventListener('hashchange', onRoute);
void boot();

// Exposed for automated checks only; reads the last server snapshot, cannot change anything.
(window as unknown as { __lab: () => unknown }).__lab = () => JSON.parse(JSON.stringify({ route: S.route, revision: S.revision, consent: S.consent, scenario: S.scenarioId, events: S.events.map((e) => e.name), fmt: fmtAge(5) }));
