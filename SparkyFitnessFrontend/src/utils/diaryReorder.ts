import { compareByEntryTime, toHourMinute } from '@workspace/shared';
import type { FoodEntryTimeChange } from '@workspace/shared';

/**
 * Reordering a meal in the diary.
 *
 * A meal's list is sorted by time (timed rows first, earliest at the top,
 * then untimed rows in the order they were logged). There is no stored
 * position, so moving a row means giving it a time that puts it where it was
 * dropped. These helpers work that time out, or say when one time is not
 * enough and the whole meal needs re-timing.
 */

export type DiaryEntryKind = FoodEntryTimeChange['kind'];

export interface ReorderItem {
  key: string;
  kind: DiaryEntryKind;
  id: string;
  name: string;
  /** 'HH:MM', or null when the row has no time. */
  time: string | null;
}

/** What the re-time dialog opens with. */
export interface MealRetimeRequest {
  /** The meal's rows in the order they should end up. */
  order: ReorderItem[];
  /** Starting times, one per row. */
  times: string[];
  /** The row that was dragged, if any, so it can be marked. */
  movedKey?: string;
}

export const DAY_LAST_MINUTE = 23 * 60 + 59;
/** Gap used when a row goes above the first or below the last timed row. */
export const EDGE_STEP_MINUTES = 15;
/** Default spacing when filling in times for a whole meal. */
export const DEFAULT_SPACING_MINUTES = 5;
const FALLBACK_START = '12:00';

export function reorderKey(kind: DiaryEntryKind, id: string): string {
  return `${kind}:${id}`;
}

export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), DAY_LAST_MINUTE);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * The diary's order for one meal: by time, then by when it was logged. Logged
 * foods and logged meals come from two lists, so they are merged here.
 */
export function sortDiaryEntries<
  T extends { entry_time?: string | null; created_at?: string },
>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      compareByEntryTime(
        toHourMinute(a.entry_time),
        toHourMinute(b.entry_time)
      ) || (a.created_at ?? '').localeCompare(b.created_at ?? '')
  );
}

/**
 * A time strictly between two others (minutes), preferring a round 5 minutes.
 * Null when there is no whole minute between them.
 */
export function timeBetween(after: number, before: number): number | null {
  if (before - after < 2) return null;
  const middle = (after + before) / 2;
  const rounded = Math.round(middle / 5) * 5;
  if (rounded > after && rounded < before) return rounded;
  return Math.floor(middle);
}

export type MovePlan =
  | { type: 'none' }
  /** One row gets a new time; the rest stay as they are. */
  | {
      type: 'set';
      order: ReorderItem[];
      moved: ReorderItem;
      newTime: string;
      above: ReorderItem | null;
      below: ReorderItem | null;
    }
  /**
   * No single time works (the row landed among untimed rows, or between two
   * rows a minute apart), so the meal needs re-timing in its new order.
   */
  | { type: 'retime'; order: ReorderItem[]; moved: ReorderItem };

export function planMove(
  items: ReorderItem[],
  fromIndex: number,
  toIndex: number
): MovePlan {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return { type: 'none' };
  }
  const order = [...items];
  const [moved] = order.splice(fromIndex, 1);
  if (!moved) return { type: 'none' };
  order.splice(toIndex, 0, moved);

  const above = order[toIndex - 1] ?? null;
  const below = order[toIndex + 1] ?? null;
  const aboveTime = above?.time ?? null;
  const belowTime = below?.time ?? null;

  let newMinutes: number | null = null;
  if (above && aboveTime === null) {
    // Landed among untimed rows. They are ordered by when they were logged,
    // which a time on this row alone cannot change.
    newMinutes = null;
  } else if (aboveTime !== null && belowTime !== null) {
    newMinutes = timeBetween(toMinutes(aboveTime), toMinutes(belowTime));
  } else if (aboveTime !== null) {
    // Last timed row (anything below has no time, and timed rows sort first).
    const after = toMinutes(aboveTime);
    newMinutes =
      after < DAY_LAST_MINUTE
        ? Math.min(after + EDGE_STEP_MINUTES, DAY_LAST_MINUTE)
        : null;
  } else if (belowTime !== null) {
    // Top of the list.
    const before = toMinutes(belowTime);
    newMinutes = before > 0 ? Math.max(before - EDGE_STEP_MINUTES, 0) : null;
  } else if (!above) {
    // Top of a list with no times at all: any time puts it first. Keep its
    // own time if it has one.
    newMinutes = moved.time ? toMinutes(moved.time) : toMinutes(FALLBACK_START);
  }

  if (newMinutes === null) return { type: 'retime', order, moved };
  return {
    type: 'set',
    order,
    moved,
    newTime: fromMinutes(newMinutes),
    above,
    below,
  };
}

/**
 * Starting times for re-timing a meal in the given order. Rows up to
 * `fillThrough` all get a time, each later than the one above: a row keeps
 * its own time when that still fits, otherwise it goes `step` minutes after
 * the row above (the first row starts at `startTime`, else noon). Rows after
 * `fillThrough` keep their time, or stay blank ('') when they had none,
 * because untimed rows already sit at the bottom in the order they were
 * logged.
 */
export function proposeTimes(
  order: ReorderItem[],
  startTime: string | null,
  fillThrough: number,
  step = DEFAULT_SPACING_MINUTES
): string[] {
  const times: string[] = [];
  let previous: number | null = null;
  order.forEach((item, index) => {
    const own = item.time ? toMinutes(item.time) : null;
    if (
      index > fillThrough &&
      (own === null || previous === null || own > previous)
    ) {
      times.push(item.time ?? '');
      if (own !== null) previous = own;
      return;
    }
    const remaining = order.length - index - 1;
    let next: number;
    if (own !== null && (previous === null || own > previous)) {
      next = own;
    } else if (previous === null) {
      next = toMinutes(startTime ?? FALLBACK_START);
    } else {
      next = previous + step;
    }
    // Leave room for the rows still to come, a minute each at least.
    next = Math.min(next, DAY_LAST_MINUTE - remaining);
    if (previous !== null && next <= previous) next = previous + 1;
    times.push(fromMinutes(next));
    previous = next;
  });
  return times;
}

/** The last row (in the given order) that has a time, or -1. */
export function lastTimedIndex(order: ReorderItem[]): number {
  for (let i = order.length - 1; i >= 0; i--) {
    if (order[i]?.time) return i;
  }
  return -1;
}

/** Evenly spaced times from the first row's time, `step` minutes apart. */
export function spaceTimes(
  first: string,
  count: number,
  step: number
): string[] {
  const start = Math.min(toMinutes(first), DAY_LAST_MINUTE - (count - 1));
  const gap = Math.max(
    1,
    Math.min(step, Math.floor((DAY_LAST_MINUTE - start) / (count - 1 || 1)))
  );
  return Array.from({ length: count }, (_, i) => fromMinutes(start + i * gap));
}

/**
 * The first row that breaks the order, or -1 when the times hold it: timed
 * rows must each be later than the one above, and a blank row may only be
 * followed by blank rows (untimed rows sort last).
 */
export function firstOutOfOrder(times: string[]): number {
  let previous: number | null = null;
  let blankAt = -1;
  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    if (!time) {
      if (blankAt === -1) blankAt = i;
      continue;
    }
    if (blankAt !== -1) return blankAt;
    const minutes = toMinutes(time);
    if (previous !== null && minutes <= previous) return i;
    previous = minutes;
  }
  return -1;
}

/** The rows whose time differs from what they hold now. */
export function timeChanges(
  order: ReorderItem[],
  times: string[]
): FoodEntryTimeChange[] {
  return order.flatMap((item, index) => {
    const time = times[index] || null;
    return time === item.time
      ? []
      : [{ kind: item.kind, id: item.id, entry_time: time }];
  });
}

/** The changes that put every changed row back on its old time. */
export function undoChanges(
  items: ReorderItem[],
  changes: FoodEntryTimeChange[]
): FoodEntryTimeChange[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return changes.flatMap((change) => {
    const item = byKey.get(reorderKey(change.kind, change.id));
    return item ? [{ ...change, entry_time: item.time }] : [];
  });
}
