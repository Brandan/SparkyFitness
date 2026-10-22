import { useTranslation } from 'react-i18next';
import { describeLastLogged, todayInZone } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';

/** "Last logged ..." text for a food, or null when it was never logged. */
const useLastLoggedLabel = (
  lastUsedDate: string | null | undefined
): string | null => {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  let today: string;
  try {
    today = todayInZone(timezone || 'UTC');
  } catch {
    return null;
  }
  const age = describeLastLogged(lastUsedDate, today);
  if (!age) return null;
  switch (age.kind) {
    case 'today':
      return t('enhancedFoodSearch.lastLoggedToday', 'Last logged today');
    case 'yesterday':
      return t(
        'enhancedFoodSearch.lastLoggedYesterday',
        'Last logged yesterday'
      );
    case 'daysAgo':
      return t(
        'enhancedFoodSearch.lastLoggedDaysAgo',
        'Last logged {{count}} days ago',
        { count: age.days }
      );
    case 'date': {
      const [y, m, d] = age.day.split('-').map(Number);
      return t('enhancedFoodSearch.lastLoggedOn', 'Last logged {{date}}', {
        date: new Date(y!, m! - 1, d).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      });
    }
  }
};

export const LastLogged = ({
  lastUsedDate,
  className = 'text-xs text-gray-500 mt-1',
}: {
  lastUsedDate: string | null | undefined;
  className?: string;
}) => {
  const label = useLastLoggedLabel(lastUsedDate);
  return label ? <p className={className}>{label}</p> : null;
};
