import {
  canonicalQuantityUnit,
  convertQuantity,
  quantityUnitChoices,
  quantityUnitStep,
  roundQuantity,
} from '../../src/utils/quantityUnits';

describe('quantityUnitChoices', () => {
  it('offers weight units for a weight-based food', () => {
    expect(quantityUnitChoices('g')).toEqual(['g', 'oz', 'lb', 'kg']);
    expect(quantityUnitChoices('oz')).toEqual(['g', 'oz', 'lb', 'kg']);
  });

  it('offers volume units for a volume-based food', () => {
    expect(quantityUnitChoices('ml')).toEqual([
      'ml',
      'fl oz',
      'cup',
      'tbsp',
      'tsp',
      'l',
    ]);
  });

  it('keeps an aliased or uncommon base unit selectable', () => {
    expect(quantityUnitChoices('lbs')).toEqual(['g', 'oz', 'lb', 'kg']);
    expect(quantityUnitChoices('mg')).toEqual(['mg', 'g', 'oz', 'lb', 'kg']);
  });

  it('offers nothing for quantity-style or missing units', () => {
    expect(quantityUnitChoices('serving')).toEqual([]);
    expect(quantityUnitChoices('piece')).toEqual([]);
    expect(quantityUnitChoices(undefined)).toEqual([]);
    expect(quantityUnitChoices('')).toEqual([]);
  });
});

describe('convertQuantity', () => {
  it('converts grams to ounces and back', () => {
    expect(convertQuantity(336, 'g', 'oz')).toBeCloseTo(11.85, 2);
    expect(convertQuantity(12, 'oz', 'g')).toBeCloseTo(340.19, 2);
  });

  it('converts volume units', () => {
    expect(convertQuantity(240, 'ml', 'cup')).toBeCloseTo(1.01, 2);
    expect(convertQuantity(1, 'fl oz', 'ml')).toBeCloseTo(29.57, 2);
  });

  it('returns the value unchanged for incompatible units', () => {
    expect(convertQuantity(5, 'g', 'ml')).toBe(5);
  });
});

describe('helpers', () => {
  it('canonicalizes aliases', () => {
    expect(canonicalQuantityUnit(' LBS ')).toBe('lb');
    expect(canonicalQuantityUnit('cups')).toBe('cup');
    expect(canonicalQuantityUnit('g')).toBe('g');
  });

  it('rounds to two decimals', () => {
    expect(roundQuantity(11.8518)).toBe(11.85);
    expect(roundQuantity(12.0001)).toBe(12);
  });

  it('steps by a sensible amount per unit', () => {
    expect(quantityUnitStep('oz')).toBe(0.5);
    expect(quantityUnitStep('weird')).toBe(1);
  });
});
