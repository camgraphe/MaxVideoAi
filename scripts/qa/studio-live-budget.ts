/** One shared journal for a user-authorized text-only validation budget. USD nanounits. */
export const STUDIO_LIVE_CAP = 5_000_000_000;
export type LiveBudget = { settled: number; held: number; blocked: boolean; capNanoUsd?: number };
export function reserveLiveCall(state: LiveBudget, amount: number): LiveBudget {
  const cap=state.capNanoUsd??STUDIO_LIVE_CAP;
  if (state.blocked || state.held || !Number.isSafeInteger(amount) || amount <= 0 ||
      !Number.isSafeInteger(cap) || cap<=0 || !Number.isSafeInteger(state.settled) || state.settled < 0 || state.settled + amount > cap)
    throw new Error('Live validation budget unavailable');
  return {...state, held: amount};
}
export function settleLiveCall(state: LiveBudget, upperCost: number | null): LiveBudget {
  if (!state.held) throw new Error('No live reservation');
  if (upperCost === null || !Number.isSafeInteger(upperCost) || upperCost < 0 || upperCost > state.held)
    return {...state, blocked: true};
  return {...state,settled: state.settled + upperCost, held: 0, blocked: false};
}
