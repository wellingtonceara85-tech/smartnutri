import { computeDiscountAmount, computeFinalValue } from './money.util';

describe('computeDiscountAmount', () => {
  it('desconto fixo retorna o próprio valor em R$', () => {
    expect(computeDiscountAmount(900, 'FIXED', 50).toString()).toBe('50');
  });

  it('desconto percentual calcula sobre o valor base (900 * 10% = 90)', () => {
    expect(computeDiscountAmount(900, 'PERCENTAGE', 10).toString()).toBe('90');
  });

  it('nunca excede o valor base, mesmo com desconto fixo maior que ele', () => {
    expect(computeDiscountAmount(100, 'FIXED', 500).toString()).toBe('100');
  });

  it('100% de desconto percentual iguala o valor base', () => {
    expect(computeDiscountAmount(900, 'PERCENTAGE', 100).toString()).toBe(
      '900',
    );
  });

  it('desconto zero não altera nada', () => {
    expect(computeDiscountAmount(900, 'FIXED', 0).toString()).toBe('0');
  });

  it('arredonda para 2 casas decimais', () => {
    expect(computeDiscountAmount(100, 'PERCENTAGE', 33.333).toString()).toBe(
      '33.33',
    );
  });
});

describe('computeFinalValue', () => {
  it('exemplo do prompt da missão: R$900 - 10% (R$90) = R$810', () => {
    const discount = computeDiscountAmount(900, 'PERCENTAGE', 10);
    expect(computeFinalValue(900, discount).toString()).toBe('810');
  });

  it('nunca fica negativo mesmo com desconto maior que o valor base', () => {
    expect(computeFinalValue(100, 500).toString()).toBe('0');
  });

  it('soma acréscimo quando informado', () => {
    expect(computeFinalValue(900, 90, 20).toString()).toBe('830');
  });

  it('sem desconto nem acréscimo, valor final é igual ao base', () => {
    expect(computeFinalValue(900, 0).toString()).toBe('900');
  });
});
