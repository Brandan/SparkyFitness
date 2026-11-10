import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useDailySummary } from '@/hooks/Diary/useDailyProgress';
import { useNutrientGoalPreferences } from '@/hooks/Settings/useNutrientGoalPreferences';
import { getEnergyUnitString } from '@/utils/nutritionCalculations';
import { computeEnergyHeadline, getEnergyRingState } from './energyHeadline';

const RING_PATH =
  'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

interface MacroTotals {
  protein: number;
  carbs: number;
  fat: number;
}

interface DiaryStickyBarProps {
  selectedDate: string;
  dayTotals: MacroTotals;
  goals: MacroTotals;
  /** Planned calories in kcal, beside what was eaten and never inside it. */
  plannedKcal: number;
}

const MacroBar = ({
  name,
  eaten,
  goal,
  textClass,
  fillClass,
}: {
  name: string;
  eaten: number;
  goal: number;
  textClass: string;
  fillClass: string;
}) => {
  const { t } = useTranslation();
  const pct = goal > 0 ? Math.min((eaten / goal) * 100, 100) : 0;
  const label = t(
    'diary.stickyBar.macroLabel',
    '{{name}} {{eaten}} of {{goal}} g',
    {
      name,
      eaten: Math.round(eaten),
      goal: Math.round(goal),
    }
  );
  return (
    <div className="min-w-0 flex-1" role="img" aria-label={label} title={label}>
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className={textClass}>{name}</span>
        <span className="font-medium tabular-nums dark:text-slate-300">
          {Math.round(eaten)}g
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/**
 * The Diary's day summary, pinned beside the date switcher: calorie ring and
 * figures, then protein, carbs and fat against their goals. The calorie
 * numbers come from `computeEnergyHeadline`, the same source as the Daily
 * Energy Goal card.
 */
const DiaryStickyBar = ({
  selectedDate,
  dayTotals,
  goals,
  plannedKcal,
}: DiaryStickyBarProps) => {
  const { t } = useTranslation();
  const { energyUnit, convertEnergy } = usePreferences();
  const { data: summaryData } = useDailySummary(selectedDate);
  const { data: goalTypePreferences } = useNutrientGoalPreferences();

  if (!summaryData?.calorieBalance) return null;

  const headline = computeEnergyHeadline({
    calorieBalance: summaryData.calorieBalance,
    calorieGoalPref: goalTypePreferences?.['calories'],
    plannedKcal,
    energyUnit,
    convertEnergy,
  });
  const unit = getEnergyUnitString(energyUnit);
  const eatenPct = Math.min(Math.max(headline.progress, 0), 100);
  const plannedPct =
    headline.goal > 0 && headline.planned > 0
      ? Math.min(
          (headline.planned / headline.goal) * 100,
          Math.max(0, 100 - eatenPct)
        )
      : 0;
  const { colorClass } = getEnergyRingState(headline.targetBand);

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
      data-testid="diary-sticky-bar"
    >
      <div className="flex shrink-0 items-center gap-2">
        <svg
          className="h-10 w-10 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden="true"
        >
          <path
            className="text-gray-200 dark:text-slate-600"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            d={RING_PATH}
          />
          <path
            className={colorClass}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={`${eatenPct}, 100`}
            d={RING_PATH}
          />
          {plannedPct > 0 && (
            <path
              className={`${colorClass} opacity-40`}
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={`${plannedPct} ${100 - plannedPct}`}
              strokeDashoffset={-eatenPct}
              d={RING_PATH}
            />
          )}
        </svg>
        <div className="leading-tight">
          <div className="text-sm font-semibold tabular-nums dark:text-slate-300">
            {headline.eaten.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-gray-500">
              {t('diary.stickyBar.ofGoal', '/ {{goal}} {{unit}}', {
                goal: headline.goal.toLocaleString(),
                unit,
              })}
            </span>
          </div>
          <div className="whitespace-nowrap text-xs text-gray-500">
            {headline.remaining >= 0
              ? t('diary.stickyBar.left', '{{amount}} left', {
                  amount: headline.remaining.toLocaleString(),
                })
              : t('diary.stickyBar.over', '{{amount}} over', {
                  amount: Math.abs(headline.remaining).toLocaleString(),
                })}
            {headline.planned > 0 && (
              <span className="hidden sm:inline">
                {` · ${t('diary.stickyBar.planned', '+{{amount}} planned', {
                  amount: headline.planned.toLocaleString(),
                })}`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="hidden min-w-0 max-w-sm flex-1 gap-3 md:flex">
        <MacroBar
          name={t('diary.stickyBar.protein', 'Protein')}
          eaten={dayTotals.protein}
          goal={goals.protein}
          textClass="text-blue-500"
          fillClass="bg-blue-500"
        />
        <MacroBar
          name={t('diary.stickyBar.carbs', 'Carbs')}
          eaten={dayTotals.carbs}
          goal={goals.carbs}
          textClass="text-green-500"
          fillClass="bg-green-500"
        />
        <MacroBar
          name={t('diary.stickyBar.fat', 'Fat')}
          eaten={dayTotals.fat}
          goal={goals.fat}
          textClass="text-yellow-500"
          fillClass="bg-yellow-500"
        />
      </div>
    </div>
  );
};

export default DiaryStickyBar;
