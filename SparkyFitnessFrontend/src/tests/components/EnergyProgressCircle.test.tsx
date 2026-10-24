import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnergyCircle } from '@/pages/Diary/EnergyProgressCircle';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      defaultValue?: string,
      options?: Record<string, unknown>
    ) => {
      const template = typeof defaultValue === 'string' ? defaultValue : _key;
      if (!options) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options[name] ?? '')
      );
    },
  }),
}));

jest.mock('@/utils/nutritionCalculations', () => ({
  getEnergyUnitString: () => 'kcal',
}));

describe('EnergyCircle planned calories', () => {
  it('draws planned calories as a lighter arc and a caption', () => {
    render(
      <EnergyCircle
        remaining={2890}
        progress={0}
        unit="kcal"
        planned={600}
        goal={2890}
      />
    );

    const arc = screen.getByTestId('planned-energy-arc');
    expect(arc).toHaveAttribute('stroke-dashoffset', '0');
    expect(arc.getAttribute('stroke-dasharray')).toMatch(/^20\.76/);
    expect(screen.getByTestId('planned-energy')).toHaveTextContent(
      '+600 kcal planned'
    );
  });

  it('leaves the ring as eaten calories when nothing is planned', () => {
    render(<EnergyCircle remaining={2890} progress={0} unit="kcal" />);

    expect(screen.queryByTestId('planned-energy-arc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planned-energy')).not.toBeInTheDocument();
  });
});
