import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidCpf } from '../utils/cpf.util';

export function IsValidCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCpf',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '')
            return true;
          return typeof value === 'string' && isValidCpf(value);
        },
        defaultMessage() {
          return 'CPF inválido';
        },
      },
    });
  };
}
