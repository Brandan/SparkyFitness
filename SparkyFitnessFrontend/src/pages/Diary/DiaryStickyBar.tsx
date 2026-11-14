import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useDailySummary } from '@/hooks/Diary/useDailyProgress';
import { useNutrientGoalPreferences } from '@/hooks/Settings/useNutrientGoalPreferences';
import { getEnergyUnitString } from '@/utils/nutritionCalculations';
import { computeEnergyHeadline, getEnergyRingState } from './energyHeadline';
import { PlannedProgressBar, VarianceBadge } from './PlannedVariance';
import {
  getPlannedVariance,
  PLANNED_FILL_OPACITY,
} from './plannedVarianceMath';

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
  /** What the day's planned meals add, beside what was eaten and never inside it. */
  plannedTotals: MacroTotals & { calories: number };
}

const MacroBar = ({
  name,
  eaten,
  planned,
  goal,
  textClass,
  color,
}: {
  name: string;
  eaten: number;
  planned: number;
  goal: number;
  textClass: string;
  color: string;
}) => {
  const { t } = useTranslation();
  const variance = getPlannedVariance(eaten, planned, goal);
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
        <span className="flex items-baseline gap-1">
          <span className="font-medium tabular-nums dark:text-slate-300">
            {Math.round(eaten)}g
          </span>
          {variance && (
            <VarianceBadge
              variance={variance}
              format={(n) => Math.round(n).toString()}
              unit="g"
              className="text-[11px]"
            />
          )}
        </span>
      </div>
      <PlannedProgressBar
        className="mt-1"
        eaten={eaten}
        planned={planned}
        goal={goal}
        color={color}
      />
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
  plannedTotals,
}: DiaryStickyBarProps) => {
  const { t } = useTranslation();
  const { energyUnit, convertEnergy } = usePreferences();
  const { data: summaryData } = useDailySummary(selectedDate);
  const { data: goalTypePreferences } = useNutrientGoalPreferences();

  if (!summaryData?.calorieBalance) return null;

  const headline = computeEnergyHeadline({
    calorieBalance: summaryData.calorieBalance,
    calorieGoalPref: goalTypePreferences?.['calories'],
    plannedKcal: plannedTotals.calories,
    energyUnit,
    convertEnergy,
  });
  const unit = getEnergyUnitString(energyUnit);
  const eatenPct = Math.min(Math.max(headline.progress, 0), 100);
  // The light arc runs from the start out to eaten plus planned, under the solid one.
  const projectedPct =
    headline.goal > 0 && headline.planned > 0
      ? Math.min(
          ((headline.eaten + headline.planned) / headline.goal) * 100,
          100
        )
      : 0;
  const calorieVariance = getPlannedVariance(
    headline.eaten,
    headline.planned,
    headline.goal
  );
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
            className="text-slate-200 dark:text-slate-700"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            d={RING_PATH}
          />
          {projectedPct > eatenPct && (
            <path
              data-testid="sticky-planned-arc"
              className={colorClass}
              style={{ opacity: PLANNED_FILL_OPACITY }}
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={`${projectedPct}, 100`}
              d={RING_PATH}
            />
          )}
          <path
            className={colorClass}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={`${eatenPct}, 100`}
            d={RING_PATH}
          />
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
            {calorieVariance && (
              <VarianceBadge
                variance={calorieVariance}
                format={(n) => Math.round(n).toLocaleString()}
                warnOver
                showWord
                className="ml-2"
              />
            )}
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
          planned={plannedTotals.protein}
          goal={goals.protein}
          textClass="text-blue-500"
          color="#2563eb"
        />
        <MacroBar
          name={t('diary.stickyBar.carbs', 'Carbs')}
          eaten={dayTotals.carbs}
          planned={plannedTotals.carbs}
          goal={goals.carbs}
          textClass="text-green-500"
          color="#16a34a"
        />
        <MacroBar
          name={t('diary.stickyBar.fat', 'Fat')}
          eaten={dayTotals.fat}
          planned={plannedTotals.fat}
          goal={goals.fat}
          textClass="text-yellow-500"
          color="#eab308"
        />
      </div>
    </div>
  );
};

export default DiaryStickyBar;
