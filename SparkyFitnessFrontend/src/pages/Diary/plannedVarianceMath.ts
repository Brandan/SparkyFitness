export interface PlannedVariance {
  /** Eaten plus planned minus the goal. Positive is over. */
  delta: number;
}

/**
 * How far the day (what was eaten plus what is planned) lands from a goal.
 * Returns null when there is no goal, or nothing to say: with no planned items
 * the figure only appears once the goal is actually passed, so an early-day
 * "under" never clutters the number.
 */
export const getPlannedVariance = (
  eaten: number,
  planned: number,
  goal: number
): PlannedVariance | null => {
  if (!(goal > 0)) return null;
  if (planned <= 0 && eaten <= goal) return null;
  const delta = eaten + planned - goal;
  if (Math.abs(delta) < 0.5) return null;
  return { delta };
};

/** The light "planned" colour sits under the solid "eaten" colour. */
export const PLANNED_FILL_OPACITY = 0.3;

/** Bluish gray track shared by every progress bar and ring in the Diary. */
export const PROGRESS_TRACK_CLASS = 'bg-slate-200 dark:bg-slate-700';
