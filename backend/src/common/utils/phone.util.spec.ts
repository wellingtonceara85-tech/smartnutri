import { buildWhatsAppLink, isValidPhone, normalizePhone } from './phone.util';

describe('phone.util', () => {
  describe('normalizePhone', () => {
    it('remove máscara e mantém apenas dígitos', () => {
      expect(normalizePhone('(11) 98888-7777')).toBe('11988887777');
    });
  });

  describe('isValidPhone', () => {
    it('aceita celular com 11 dígitos (DDD + 9 + número)', () => {
      expect(isValidPhone('(11) 98888-7777')).toBe(true);
    });

    it('aceita fixo com 10 dígitos', () => {
      expect(isValidPhone('(11) 3888-7777')).toBe(true);
    });

    it('rejeita número sem DDD', () => {
      expect(isValidPhone('98888-7777')).toBe(false);
    });
  });

  describe('buildWhatsAppLink', () => {
    it('adiciona o DDI 55 quando ausente', () => {
      expect(buildWhatsAppLink('11988887777')).toBe(
        'https://wa.me/5511988887777',
      );
    });

    it('não duplica o DDI quando já presente', () => {
      expect(buildWhatsAppLink('5511988887777')).toBe(
        'https://wa.me/5511988887777',
      );
    });
  });
});
