import { evaluateFormula, validateFormula } from './formula-parser';

describe('validateFormula', () => {
  it('accepts a valid single-variable formula', () => {
    expect(validateFormula('{{btc_price}}')).toEqual({ valid: true });
  });

  it('accepts a multi-variable arithmetic formula', () => {
    expect(validateFormula('{{market_cap}} / {{circulating_supply}}')).toEqual({ valid: true });
  });

  it('accepts nested parentheses', () => {
    expect(
      validateFormula('({{btc_price}} / ({{stock_to_flow}} * 1000) - 1) * 100'),
    ).toEqual({ valid: true });
  });

  it('rejects a formula that exceeds 200 characters', () => {
    const long = '{{btc_price}} + ' + '1 + '.repeat(50);
    expect(validateFormula(long)).toMatchObject({ valid: false });
  });

  it('rejects a formula with no variables', () => {
    expect(validateFormula('42 + 1')).toMatchObject({
      valid: false,
      error: 'Formula must contain at least one variable',
    });
  });

  it('rejects an unknown variable', () => {
    expect(validateFormula('{{xyz}} + 1')).toMatchObject({
      valid: false,
      error: 'Unknown variable: {{xyz}}',
    });
  });

  it('rejects a formula with mismatched parentheses', () => {
    expect(validateFormula('{{btc_price}} * (2 + 3')).toMatchObject({
      valid: false,
      error: 'Formula syntax error',
    });
  });

  it('rejects a formula with unbalanced closing parenthesis', () => {
    expect(validateFormula('{{btc_price}} * 2)')).toMatchObject({
      valid: false,
      error: 'Formula syntax error',
    });
  });

  it('rejects a formula with forbidden characters', () => {
    expect(validateFormula('{{btc_price}} ^ 2')).toMatchObject({
      valid: false,
      error: 'Formula syntax error',
    });
  });
});

describe('evaluateFormula', () => {
  it('evaluates a simple variable reference', () => {
    expect(
      evaluateFormula('{{btc_price}}', { btc_price: 67234.5 }),
    ).toEqual({ value: 67234.5 });
  });

  it('evaluates division of two variables', () => {
    const result = evaluateFormula('{{market_cap}} / {{circulating_supply}}', {
      market_cap: 1_320_000_000_000,
      circulating_supply: 19_700_000,
    });
    expect(result.value).toBeCloseTo(67005.08, 1);
  });

  it('evaluates a complex multi-operator formula with parentheses', () => {
    const result = evaluateFormula(
      '({{btc_price}} / ({{stock_to_flow}} * 1000) - 1) * 100',
      { btc_price: 67234.5, stock_to_flow: 56.2 },
    );
    expect(result.value).toBeCloseTo(19.64, 1);
  });

  it('returns null with a data-unavailable error when a variable is null', () => {
    expect(
      evaluateFormula('{{mvrv_zscore}} * 2', { mvrv_zscore: null }),
    ).toEqual({ value: null, error: 'Data unavailable — Check back soon' });
  });

  it('returns a division-by-zero error', () => {
    expect(
      evaluateFormula('{{btc_price}} / {{circulating_supply}}', {
        btc_price: 67234.5,
        circulating_supply: 0,
      }),
    ).toMatchObject({ value: null, error: expect.stringContaining('Division by zero') });
  });

  it('handles unary negation in the formula', () => {
    expect(
      evaluateFormula('-{{btc_price_24h_change}} + 1', { btc_price_24h_change: -2.3 }),
    ).toEqual({ value: 3.3 });
  });

  it('handles stock_to_flow * literal constant', () => {
    expect(
      evaluateFormula('{{stock_to_flow}} * 1000', { stock_to_flow: 56.2 }),
    ).toEqual({ value: 56200 });
  });
});
