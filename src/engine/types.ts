export type CategoryId = 'drinks' | 'meals' | 'outside' | 'wake' | 'night' | 'bathroom';
export type SensorId = 'hub' | 'kettle' | 'fridge' | 'frontDoor' | 'bedroom' | 'hallway' | 'bathroomSensor';
export type SensorStatus = 'ready' | 'waiting' | 'notPaired' | 'offline' | 'lowBattery';
export type ConsentStatus = 'notInvited' | 'pending' | 'accepted' | 'declined' | 'revoked';
export type Actor = 'family' | 'monitored';
export type Frequency = 'off' | 'weekly' | 'daily' | 'changes';
export type ScenarioId = 'day0' | 'stable' | 'changed' | 'gaps' | 'stale';
export type CopyVariant = 'setupFirst' | 'benefitFirst';

export interface Household {
  id: string;
  label: string;
  person: string;
  age: number;
  living: string;
  you: string;
  defaultRelationship: string;
  defaultGoal: string;
  defaultScenario: ScenarioId;
}

/** One value per simulated day; null = no data received that day. */
export type DaySeries = (number | null)[];

export interface Scenario {
  id: ScenarioId;
  label: string;
  summary: string;
  /** Whole days of data since setup finished. 0 = setup finished today. */
  daysElapsed: number;
  hoursSinceSetup: number;
  /** Hours since the hub last sent anything. */
  hubLastSeenHours: number;
  /** Initial sensor states for this scenario. */
  sensors: Record<SensorId, SensorStatus>;
  /** Daily event counts per category, oldest first. */
  series: Record<CategoryId, DaySeries>;
  /** First kettle use per day, "HH:MM", for routine copy. */
  firstKettle: (string | null)[];
  /** Usual wake-up window from bedroom motion per day. */
  wake: (string | null)[];
  /** Minutes since the latest event per category on the last day (null = none). */
  lastEventMins: Record<CategoryId, number | null>;
}

export interface ConsentState {
  status: ConsentStatus;
  shared: CategoryId[];
  history: { at: number; actor: Actor; action: string; detail?: string }[];
}

export interface TrackedEvent {
  name: string;
  props: Record<string, string | number | boolean>;
}
