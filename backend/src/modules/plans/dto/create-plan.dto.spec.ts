import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePlanDto } from './create-plan.dto';

const validPayload = {
  name: 'Plano Trimestral',
  durationMonths: 3,
  suggestedAppointments: 3,
  suggestedIntervalDays: 30,
  defaultPrice: 900,
  defaultInstallments: 3,
};

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreatePlanDto, payload);
  return validate(dto);
}

describe('CreatePlanDto', () => {
  it('é válido com os campos obrigatórios corretos', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejeita duração menor ou igual a zero', async () => {
    const errors = await validateDto({ ...validPayload, durationMonths: 0 });
    expect(errors.some((e) => e.property === 'durationMonths')).toBe(true);
  });

  it('rejeita quantidade de consultas menor ou igual a zero', async () => {
    const errors = await validateDto({
      ...validPayload,
      suggestedAppointments: 0,
    });
    expect(errors.some((e) => e.property === 'suggestedAppointments')).toBe(
      true,
    );
  });

  it('rejeita intervalo entre consultas menor ou igual a zero', async () => {
    const errors = await validateDto({
      ...validPayload,
      suggestedIntervalDays: 0,
    });
    expect(errors.some((e) => e.property === 'suggestedIntervalDays')).toBe(
      true,
    );
  });

  it('rejeita valor padrão negativo', async () => {
    const errors = await validateDto({ ...validPayload, defaultPrice: -10 });
    expect(errors.some((e) => e.property === 'defaultPrice')).toBe(true);
  });

  it('rejeita quantidade de parcelas menor ou igual a zero', async () => {
    const errors = await validateDto({
      ...validPayload,
      defaultInstallments: 0,
    });
    expect(errors.some((e) => e.property === 'defaultInstallments')).toBe(true);
  });
});
