import { derive, freshLabState, householdOf, scenarioOf, type Derived, type LabState } from './server/model';

export type Route = 'start' | 'consent' | 'setup' | 'today' | 'week' | 'lab';
export const ROUTES: { id: Route; label: string; step?: number }[] = [
  { id: 'start', label: 'Start', step: 1 },
  { id: 'consent', label: 'Consent', step: 2 },
  { id: 'setup', label: 'Setup', step: 3 },
  { id: 'today', label: 'Today', step: 4 },
  { id: 'week', label: 'Week', step: 5 },
  { id: 'lab', label: 'Lab' },
];

/** Server state (read-only copy of the last snapshot) plus browser-only UI fields. */
export interface AppState extends LabState {
  revision: number;
  route: Route;
  draftShare: LabState['consent']['shared'];
  notice: string | null;
  error: string | null;
}

export const placeholderState = (): AppState => ({ ...freshLabState(), revision: 0, route: 'start', draftShare: [], notice: null, error: null });
export const placeholderDerived = (): Derived => derive(freshLabState());

export const household = (s: AppState) => householdOf(s);
export const scenario = (s: AppState) => scenarioOf(s);
