import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'admin',
  'admin123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'login',
  'princess',
  'football',
  'shadow',
  'sunshine',
  'trustno1',
  'iloveyou',
  'batman',
  'access',
  'hello',
  'charlie',
  'donald',
  'mustang',
  'michael',
  'andrew',
  'joshua',
  'george',
  'password!',
  'Password1',
  'Password123',
  'Qwerty123',
  'Admin123',
  'Letmein1',
  'Welcome1',
  'Summer2024',
  'Winter2024',
  'Spring2024',
  'January2024',
]);

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value) return false;
    const lower = value.toLowerCase();
    return !COMMON_PASSWORDS.has(lower) && !COMMON_PASSWORDS.has(value);
  }

  defaultMessage() {
    return 'Password is too common. Please choose a stronger password.';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsStrongPasswordConstraint,
    });
  };
}
