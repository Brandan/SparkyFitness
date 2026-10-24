import {
  firstOutOfOrder,
  lastTimedIndex,
  planMove,
  proposeTimes,
  sortDiaryEntries,
  spaceTimes,
  timeBetween,
  timeChanges,
  undoChanges,
  type ReorderItem,
} from '@/utils/diaryReorder';

const item = (id: string, time: string | null): ReorderItem => ({
  key: `foodEntry:${id}`,
  kind: 'foodEntry',
  id,
  name: id,
  time,
});

describe('sortDiaryEntries', () => {
  it('puts timed rows first by time, then untimed rows by when they were logged', () => {
    const sorted = sortDiaryEntries([
      { id: 'late', entry_time: '09:30:00', created_at: '2026-10-23T01:00' },
      { id: 'untimed-2', entry_time: null, created_at: '2026-10-23T03:00' },
      { id: 'early', entry_time: '07:15', created_at: '2026-10-23T05:00' },
      { id: 'untimed-1', entry_time: null, created_at: '2026-10-23T02:00' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual([
      'early',
      'late',
      'untimed-1',
      'untimed-2',
    ]);
  });
});

describe('timeBetween', () => {
  it('prefers a round 5 minutes', () => {
    expect(timeBetween(7 * 60 + 15, 9 * 60 + 30)).toBe(8 * 60 + 25);
  });
  it('falls back to the exact middle when no 5-minute mark fits', () => {
    expect(timeBetween(481, 484)).toBe(482);
  });
  it('returns null when there is no whole minute between', () => {
    expect(timeBetween(480, 481)).toBeNull();
    expect(timeBetween(480, 480)).toBeNull();
  });
});

describe('planMove', () => {
  const coffee = item('coffee', '07:15');
  const oats = item('oats', '09:30');
  const juice = item('juice', '10:00');
  const toast = item('toast', null);
  const egg = item('egg', null);

  it('does nothing when dropped in place', () => {
    expect(planMove([coffee, oats], 1, 1)).toEqual({ type: 'none' });
  });

  it('times a row dropped between two timed rows', () => {
    const plan = planMove([coffee, oats, juice], 2, 1);
    expect(plan).toMatchObject({
      type: 'set',
      newTime: '08:25',
      above: coffee,
      below: oats,
    });
    if (plan.type === 'set') {
      expect(plan.order.map((i) => i.id)).toEqual(['coffee', 'juice', 'oats']);
    }
  });

  it('times a row dropped at the top 15 minutes before the first', () => {
    expect(planMove([coffee, oats, juice], 2, 0)).toMatchObject({
      type: 'set',
      newTime: '07:00',
      above: null,
      below: coffee,
    });
  });

  it('gives an untimed row a time when it moves into the timed rows', () => {
    // toast lands right after oats, above the untimed egg.
    expect(planMove([coffee, oats, toast, egg], 2, 1)).toMatchObject({
      type: 'set',
      newTime: '08:25',
    });
    expect(planMove([coffee, oats, egg, toast], 3, 2)).toMatchObject({
      type: 'set',
      newTime: '09:45',
      above: oats,
      below: egg,
    });
  });

  it('asks for re-timing when a row lands among untimed rows', () => {
    const plan = planMove([coffee, toast, egg], 0, 2);
    expect(plan.type).toBe('retime');
    if (plan.type === 'retime') {
      expect(plan.order.map((i) => i.id)).toEqual(['toast', 'egg', 'coffee']);
    }
  });

  it('asks for re-timing when the neighbours are a minute apart', () => {
    const a = item('a', '08:00');
    const b = item('b', '08:01');
    const c = item('c', '09:00');
    expect(planMove([a, b, c], 2, 1).type).toBe('retime');
  });

  it('asks for re-timing at the top when the first row is at midnight', () => {
    const a = item('a', '00:00');
    const b = item('b', '01:00');
    expect(planMove([a, b], 1, 0).type).toBe('retime');
  });

  it('gives a fallback time to a row moved to the top of an untimed meal', () => {
    expect(planMove([toast, egg], 1, 0)).toMatchObject({
      type: 'set',
      newTime: '12:00',
    });
  });
});

describe('proposeTimes', () => {
  it('keeps times that still fit and fills the rest after the row above', () => {
    const order = [
      item('a', '08:00'),
      item('b', '07:00'),
      item('c', null),
      item('d', '09:00'),
    ];
    expect(proposeTimes(order, null, 3)).toEqual([
      '08:00',
      '08:05',
      '08:10',
      '09:00',
    ]);
  });

  it('starts from the meal default time and leaves trailing untimed rows blank', () => {
    const order = [item('a', null), item('b', null), item('c', null)];
    expect(proposeTimes(order, '07:30', 1)).toEqual(['07:30', '07:35', '']);
  });

  it('never runs past the end of the day', () => {
    const order = [item('a', '23:58'), item('b', null), item('c', null)];
    const times = proposeTimes(order, null, 2);
    expect(times).toEqual(['23:57', '23:58', '23:59']);
    expect(firstOutOfOrder(times)).toBe(-1);
  });
});

describe('lastTimedIndex', () => {
  it('finds the last row with a time', () => {
    expect(lastTimedIndex([item('a', '08:00'), item('b', null)])).toBe(0);
    expect(lastTimedIndex([item('a', null)])).toBe(-1);
  });
});

describe('spaceTimes', () => {
  it('spaces rows evenly from the first time', () => {
    expect(spaceTimes('08:00', 3, 15)).toEqual(['08:00', '08:15', '08:30']);
  });
  it('squeezes the gap to fit before midnight', () => {
    const times = spaceTimes('23:50', 4, 30);
    expect(times[0]).toBe('23:50');
    expect(firstOutOfOrder(times)).toBe(-1);
    expect(times.at(-1)! <= '23:59').toBe(true);
  });
});

describe('firstOutOfOrder', () => {
  it('accepts increasing times with blank rows at the bottom', () => {
    expect(firstOutOfOrder(['08:00', '08:05', '', ''])).toBe(-1);
  });
  it('flags a time not later than the one above', () => {
    expect(firstOutOfOrder(['08:00', '08:00'])).toBe(1);
    expect(firstOutOfOrder(['08:00', '07:00'])).toBe(1);
  });
  it('flags a blank row with a timed row below it', () => {
    expect(firstOutOfOrder(['08:00', '', '09:00'])).toBe(1);
  });
});

describe('timeChanges and undoChanges', () => {
  it('lists only rows whose time changes, and how to put them back', () => {
    const order = [item('a', '08:00'), item('b', null), item('c', '09:00')];
    const changes = timeChanges(order, ['08:00', '08:30', '']);
    expect(changes).toEqual([
      { kind: 'foodEntry', id: 'b', entry_time: '08:30' },
      { kind: 'foodEntry', id: 'c', entry_time: null },
    ]);
    expect(undoChanges(order, changes)).toEqual([
      { kind: 'foodEntry', id: 'b', entry_time: null },
      { kind: 'foodEntry', id: 'c', entry_time: '09:00' },
    ]);
  });
});
