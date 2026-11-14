import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  PLANNED_FILL_OPACITY,
  PROGRESS_TRACK_CLASS,
  type PlannedVariance,
} from './plannedVarianceMath';

interface PlannedProgressBarProps {
  eaten: number;
  planned: number;
  goal: number;
  /** Solid colour for what was eaten; the planned part is a lighter tint of it. */
  color: string;
  heightClass?: string;
  className?: string;
}

/**
 * A bar with a bluish gray track, a light tint out to eaten plus planned, and
 * the solid colour for what was eaten on top of it.
 */
export const PlannedProgressBar = ({
  eaten,
  planned,
  goal,
  color,
  heightClass = 'h-1.5',
  className,
}: PlannedProgressBarProps) => {
  const eatenPct = goal > 0 ? Math.min((eaten / goal) * 100, 100) : 0;
  const projectedPct =
    goal > 0 && planned > 0
      ? Math.min(((eaten + planned) / goal) * 100, 100)
      : 0;
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-full',
        PROGRESS_TRACK_CLASS,
        heightClass,
        className
      )}
    >
      {projectedPct > eatenPct && (
        <div
          data-testid="planned-bar"
          className="absolute inset-y-0 left-0"
          style={{
            width: `${projectedPct}%`,
            backgroundColor: color,
            opacity: PLANNED_FILL_OPACITY,
          }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${eatenPct}%`, backgroundColor: color }}
      />
    </div>
  );
};

interface VarianceBadgeProps {
  variance: PlannedVariance;
  /** Formats the absolute amount, e.g. `(n) => Math.round(n).toString()`. */
  format: (amount: number) => string;
  unit?: string;
  /** Add "over" / "under" after the figure where there is room. */
  showWord?: boolean;
  /** Draw attention to going over (calories, maximum limits). */
  warnOver?: boolean;
  title?: string;
  className?: string;
}

/** "+300 over" / "−150 under", the sign and word carry the meaning, not colour. */
export const VarianceBadge = ({
  variance,
  format,
  unit = '',
  showWord = false,
  warnOver = false,
  title,
  className,
}: VarianceBadgeProps) => {
  const { t } = useTranslation();
  const over = variance.delta > 0;
  const sign = over ? '+' : '−';
  const word = over
    ? t('diary.variance.over', 'over')
    : t('diary.variance.under', 'under');
  const text = `${sign}${format(Math.abs(variance.delta))}${unit}`;
  return (
    <span
      data-testid="planned-variance"
      title={title ?? t('diary.variance.title', 'Eaten plus planned vs goal')}
      aria-label={`${text} ${word}`}
      className={cn(
        'whitespace-nowrap text-xs font-semibold tabular-nums',
        over && warnOver
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-600 dark:text-slate-300',
        className
      )}
    >
      {text}
      {showWord && ` ${word}`}
    </span>
  );
};
