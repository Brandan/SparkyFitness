import { computeEnergyHeadline } from '@/pages/Diary/energyHeadline';

const balance = {
  eaten: 1400,
  burned: 2200,
  remaining: 700,
  goal: 2100,
  net: -800,
  progress: 66.7,
  bmr: 1700,
  exerciseSource: 'none' as const,
  tdeeProjection: null,
};

const convertEnergy = (value: number, from: string, to: string) =>
  from === to ? value : value * 4.184;

const base = {
  calorieBalance: balance,
  plannedKcal: 300,
  energyUnit: 'kcal' as const,
  convertEnergy,
};

describe('computeEnergyHeadline', () => {
  it('uses the server calorie balance when no target band is set', () => {
    expect(
      computeEnergyHeadline({ ...base, calorieGoalPref: undefined })
    ).toEqual({
      goal: 2100,
      eaten: 1400,
      remaining: 700,
      progress: 66.7,
      planned: 300,
      targetBand: undefined,
    });
  });

  it('treats the top of a target band as the budget', () => {
    const headline = computeEnergyHeadline({
      ...base,
      calorieGoalPref: { goalType: 'target', targetMin: 1800, targetMax: 2000 },
    });
    expect(headline.goal).toBe(2000);
    expect(headline.remaining).toBe(600);
    expect(headline.targetBand).toEqual({ min: 1800, max: 2000, eaten: 1400 });
  });

  it('converts to the display unit', () => {
    const headline = computeEnergyHeadline({
      ...base,
      energyUnit: 'kJ',
      calorieGoalPref: undefined,
    });
    expect(headline.eaten).toBe(5858);
  });
});
