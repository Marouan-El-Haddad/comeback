// Small display helpers shared by the screens.
import type { SessionPlan } from '../engine/plan.ts';

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Minutes a session takes: the motor's own phases, otherwise the template's length (D13). */
export function sessionMinutes(plan: SessionPlan): number {
  if (plan.motor) {
    const seconds = plan.motor.phases.reduce((sum, p) => sum + p.seconds, 0);
    if (seconds > 0) return Math.round(seconds / 60);
  }
  return plan.durationMin[1];
}
