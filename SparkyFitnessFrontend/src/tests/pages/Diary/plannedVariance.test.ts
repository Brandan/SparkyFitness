import { getPlannedVariance } from '@/pages/Diary/plannedVarianceMath';

describe('getPlannedVariance', () => {
  it('is over by the eaten plus planned amount above the goal', () => {
    expect(getPlannedVariance(1500, 800, 2000)).toEqual({ delta: 300 });
  });

  it('is under when the planned day stays below the goal', () => {
    expect(getPlannedVariance(1000, 850, 2000)).toEqual({ delta: -150 });
  });

  it('stays quiet early in the day with nothing planned', () => {
    expect(getPlannedVariance(400, 0, 2000)).toBeNull();
  });

  it('reports going over the goal with nothing planned', () => {
    expect(getPlannedVariance(2100, 0, 2000)).toEqual({ delta: 100 });
  });

  it('has nothing to say without a goal or when exactly on it', () => {
    expect(getPlannedVariance(100, 50, 0)).toBeNull();
    expect(getPlannedVariance(1500, 500, 2000)).toBeNull();
  });
});
