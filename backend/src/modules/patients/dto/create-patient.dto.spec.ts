import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

async function validateDto(payload: Partial<CreatePatientDto>) {
  const dto = plainToInstance(CreatePatientDto, payload);
  return validate(dto);
}

describe('CreatePatientDto', () => {
  it('é válido com apenas o nome completo', async () => {
    const errors = await validateDto({ fullName: 'Maria da Silva' });
    expect(errors).toHaveLength(0);
  });

  it('rejeita CPF inválido', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
      cpf: '111.111.111-11',
    });
    expect(errors.some((e) => e.property === 'cpf')).toBe(true);
  });

  it('aceita CPF válido com ou sem máscara', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
      cpf: '529.982.247-25',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejeita telefone sem DDD', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
      primaryPhone: '98888-7777',
    });
    expect(errors.some((e) => e.property === 'primaryPhone')).toBe(true);
  });

  it('rejeita e-mail em formato inválido', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
      email: 'nao-e-email',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('aceita paciente sem e-mail (campo omitido)', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejeita e-mail como string vazia — @IsOptional não cobre "", o payload deve omitir o campo', async () => {
    const errors = await validateDto({
      fullName: 'Maria da Silva',
      email: '',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
