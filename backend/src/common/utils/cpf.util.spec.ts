import { isValidCpf, normalizeCpf } from './cpf.util';

describe('cpf.util', () => {
  describe('normalizeCpf', () => {
    it('remove pontuação e mantém apenas dígitos', () => {
      expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
    });
  });

  describe('isValidCpf', () => {
    it('aceita um CPF válido com máscara', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true);
    });

    it('aceita um CPF válido sem máscara', () => {
      expect(isValidCpf('52998224725')).toBe(true);
    });

    it('rejeita CPF com dígito verificador incorreto', () => {
      expect(isValidCpf('529.982.247-26')).toBe(false);
    });

    it('rejeita CPF com todos os dígitos iguais', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
      expect(isValidCpf('00000000000')).toBe(false);
    });

    it('rejeita CPF com quantidade de dígitos incorreta', () => {
      expect(isValidCpf('123456789')).toBe(false);
      expect(isValidCpf('123456789012')).toBe(false);
    });
  });
});
