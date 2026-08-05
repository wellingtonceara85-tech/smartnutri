import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidPhone } from '../utils/phone.util';

export function IsValidPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '')
            return true;
          return typeof value === 'string' && isValidPhone(value);
        },
        defaultMessage() {
          return 'Telefone inválido — informe DDD + número';
        },
      },
    });
  };
}
