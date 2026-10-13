import type { CategoryId, Household, Scenario, SensorId, SensorStatus, ScenarioId } from './types';

/** All people, places and numbers below are fictional and synthetic. */
export const HOUSEHOLDS: Household[] = [
  {
    id: 'hh-fern',
    label: 'Fern Cottage (fictional)',
    person: 'Grace',
    age: 81,
    living: 'Lives alone in a two-bedroom bungalow',
    you: 'Daniel, her son, two hours away',
    defaultRelationship: 'child',
    defaultGoal: 'fewerCalls',
    defaultScenario: 'stable',
  },
  {
    id: 'hh-harbour',
    label: 'Harbour Flat (fictional)',
    person: 'Ted',
    age: 76,
    living: 'Lives alone in a first-floor flat',
    you: 'Priya, his niece, shares check-ins with her brother',
    defaultRelationship: 'niece',
    defaultGoal: 'coordinate',
    defaultScenario: 'changed',
  },
  {
    id: 'hh-orchard',
    label: 'Orchard Row (fictional)',
    person: 'Margit',
    age: 88,
    living: 'Lives alone; a friend visits twice a week',
    you: 'Sam, a friend and neighbour',
    defaultRelationship: 'friend',
    defaultGoal: 'noticeChange',
    defaultScenario: 'gaps',
  },
];

export const RELATIONSHIPS: { id: string; label: string }[] = [
  { id: 'child', label: 'Son or daughter' },
  { id: 'grandchild', label: 'Grandchild' },
  { id: 'niece', label: 'Niece or nephew' },
  { id: 'partner', label: 'Partner living elsewhere' },
  { id: 'friend', label: 'Friend or neighbour' },
];

export const GOALS: { id: string; label: string; benefit: string }[] = [
  { id: 'fewerCalls', label: 'Feel reassured without calling every day', benefit: 'A short morning note on whether the usual routine has started.' },
  { id: 'noticeChange', label: 'Notice when the usual routine looks different', benefit: 'A weekly summary that shows what is different from earlier days, with how sure it is.' },
  { id: 'coordinate', label: 'Share check-ins with other family', benefit: 'One shared weekly summary, so nobody has to relay updates.' },
];

export const CATEGORIES: { id: CategoryId; label: string; sensor: SensorId; plain: string; unit: string }[] = [
  { id: 'drinks', label: 'Drinks', sensor: 'kettle', plain: 'when the kettle is used', unit: 'kettle uses' },
  { id: 'meals', label: 'Meals', sensor: 'fridge', plain: 'when the fridge door opens', unit: 'fridge opens' },
  { id: 'outside', label: 'Time outside', sensor: 'frontDoor', plain: 'when the front door opens', unit: 'front-door opens' },
  { id: 'wake', label: 'Waking up', sensor: 'bedroom', plain: 'first movement in the bedroom each morning', unit: 'bedroom movements' },
  { id: 'night', label: 'Night-time movement', sensor: 'hallway', plain: 'hallway movement between 11pm and 6am', unit: 'night movements' },
  { id: 'bathroom', label: 'Bathroom visits', sensor: 'bathroomSensor', plain: 'how often the bathroom is used (not what happens there)', unit: 'bathroom visits' },
];

export const SENSORS: { id: SensorId; label: string; place: string }[] = [
  { id: 'hub', label: 'Hub', place: 'Plug in near the router' },
  { id: 'kettle', label: 'Kettle smart plug', place: 'Between the kettle and the wall socket' },
  { id: 'fridge', label: 'Fridge door sensor', place: 'On the fridge door edge' },
  { id: 'frontDoor', label: 'Front door sensor', place: 'On the front door frame' },
  { id: 'bedroom', label: 'Bedroom motion sensor', place: 'On a shelf facing the bed' },
  { id: 'hallway', label: 'Hallway motion sensor', place: 'At hip height in the hallway' },
  { id: 'bathroomSensor', label: 'Bathroom sensor', place: 'On the bathroom wall, away from the shower' },
];

const allReady: Record<SensorId, SensorStatus> = {
  hub: 'ready', kettle: 'ready', fridge: 'ready', frontDoor: 'ready', bedroom: 'ready', hallway: 'ready', bathroomSensor: 'ready',
};

const s = (...v: (number | null)[]) => v;

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  day0: {
    id: 'day0',
    label: 'Day 0: setup just finished',
    summary: 'Sensors were placed three hours ago. Too early for any insight.',
    daysElapsed: 0,
    hoursSinceSetup: 3,
    hubLastSeenHours: 0.1,
    sensors: { ...allReady, hallway: 'waiting', bathroomSensor: 'notPaired' },
    series: { drinks: s(), meals: s(), outside: s(), wake: s(), night: s(), bathroom: s() },
    firstKettle: [],
    wake: [],
    lastEventMins: { drinks: 25, meals: 40, outside: 130, wake: null, night: null, bathroom: null },
  },
  stable: {
    id: 'stable',
    label: 'Week 1: steady routine',
    summary: 'All shared sensors reported on all 7 days with a similar pattern each day.',
    daysElapsed: 7,
    hoursSinceSetup: 172,
    hubLastSeenHours: 0.2,
    sensors: { ...allReady },
    series: {
      drinks: s(5, 6, 5, 5, 6, 5, 6),
      meals: s(9, 8, 10, 9, 9, 8, 9),
      outside: s(2, 3, 2, 2, 3, 2, 2),
      wake: s(14, 12, 13, 15, 13, 12, 14),
      night: s(1, 2, 1, 1, 2, 1, 1),
      bathroom: s(6, 7, 6, 6, 7, 6, 6),
    },
    firstKettle: ['07:35', '07:50', '07:40', '07:45', '07:30', '07:55', '07:40'],
    wake: ['07:10', '07:25', '07:15', '07:20', '07:05', '07:30', '07:15'],
    lastEventMins: { drinks: 12, meals: 34, outside: 95, wake: 50, night: 400, bathroom: 20 },
  },
  changed: {
    id: 'changed',
    label: 'Week 1: routine looks different',
    summary: 'All sensors reported. Front-door and kettle use dropped in the last 3 days compared with the first 4.',
    daysElapsed: 7,
    hoursSinceSetup: 170,
    hubLastSeenHours: 0.3,
    sensors: { ...allReady },
    series: {
      drinks: s(6, 5, 6, 6, 3, 3, 2),
      meals: s(9, 9, 8, 9, 8, 7, 8),
      outside: s(3, 3, 2, 3, 0, 1, 0),
      wake: s(13, 14, 12, 13, 12, 13, 12),
      night: s(1, 1, 2, 1, 3, 4, 3),
      bathroom: s(6, 6, 7, 6, 7, 6, 7),
    },
    firstKettle: ['07:40', '07:35', '07:45', '07:40', '09:10', '09:25', '09:40'],
    wake: ['07:15', '07:10', '07:20', '07:15', '07:30', '07:20', '07:25'],
    lastEventMins: { drinks: 70, meals: 45, outside: 2900, wake: 60, night: 380, bathroom: 30 },
  },
  gaps: {
    id: 'gaps',
    label: 'Week 1: patchy coverage',
    summary: 'The kettle plug was unplugged and the bathroom sensor stopped on day 3, so most days are incomplete.',
    daysElapsed: 7,
    hoursSinceSetup: 168,
    hubLastSeenHours: 0.5,
    sensors: { ...allReady, kettle: 'offline', bathroomSensor: 'offline', hallway: 'lowBattery' },
    series: {
      drinks: s(5, 5, null, null, null, null, null),
      meals: s(8, 9, 8, 9, 8, 9, 8),
      outside: s(2, 2, 3, 2, 2, 3, 2),
      wake: s(12, 13, null, 12, null, null, 13),
      night: s(1, null, null, 2, null, 1, null),
      bathroom: s(6, 6, null, null, null, null, null),
    },
    firstKettle: ['07:40', '07:45', null, null, null, null, null],
    wake: ['07:20', '07:15', null, '07:25', null, null, '07:10'],
    lastEventMins: { drinks: null, meals: 40, outside: 180, wake: 90, night: null, bathroom: null },
  },
  stale: {
    id: 'stale',
    label: 'Day 3: hub has gone quiet',
    summary: 'The hub last reported 30 hours ago (for example a router restart). Nothing newer is known.',
    daysElapsed: 3,
    hoursSinceSetup: 76,
    hubLastSeenHours: 30,
    sensors: { ...allReady, hub: 'offline' },
    series: {
      drinks: s(5, 6, null),
      meals: s(9, 8, null),
      outside: s(2, 2, null),
      wake: s(13, 12, null),
      night: s(1, 1, null),
      bathroom: s(6, 7, null),
    },
    firstKettle: ['07:40', '07:35', null],
    wake: ['07:15', '07:10', null],
    lastEventMins: { drinks: 1810, meals: 1830, outside: 2000, wake: 2100, night: 2400, bathroom: 1805 },
  },
};
