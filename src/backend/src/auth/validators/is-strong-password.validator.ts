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
  'password1234',
  'password12345',
  'admin',
  'admin123',
  'administrator',
  'root',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '123123',
  '123123123',
  '123321',
  '654321',
  '666666',
  '111111',
  '000000',
  '121212',
  '112233',
  '123321',
  '696969',
  'qwerty',
  'qwerty123',
  'qwerty1',
  'qwert',
  'qwertyuiop',
  'abc123',
  'abcd1234',
  'abcdef',
  'letmein',
  'letmein1',
  'letmein123',
  'welcome',
  'welcome1',
  'welcome123',
  'monkey',
  'dragon',
  'master',
  'login',
  'princess',
  'football',
  'baseball',
  'hockey',
  'soccer',
  'shadow',
  'sunshine',
  'trustno1',
  'iloveyou',
  'batman',
  'superman',
  'spiderman',
  'ironman',
  'access',
  'hello',
  'hello123',
  'hello1',
  'charlie',
  'donald',
  'mustang',
  'michael',
  'andrew',
  'joshua',
  'george',
  'jennifer',
  'jessica',
  'ashley',
  'amanda',
  'matthew',
  'daniel',
  'password!',
  'Password1',
  'Password123',
  'Password1234',
  'Qwerty123',
  'Qwerty1',
  'Admin123',
  'Admin1234',
  'Letmein1',
  'Letmein123',
  'Welcome1',
  'Welcome123',
  'Summer2024',
  'Summer2025',
  'Summer2026',
  'Winter2024',
  'Winter2025',
  'Winter2026',
  'Spring2024',
  'Spring2025',
  'Spring2026',
  'January2024',
  'January2025',
  'January2026',
  'February2024',
  'March2024',
  'April2024',
  'starwars',
  'startrek',
  'pokemon',
  'naruto',
  'liverpool',
  'chelsea',
  'arsenal',
  'barcelona',
  'secret',
  'changeme',
  'changeme123',
  'default',
  'test',
  'test123',
  'test1234',
  'testing',
  'guest',
  'guest123',
  'temp',
  'temp123',
  'p@ssword',
  'p@ssw0rd',
  'p@55w0rd',
  'Pa$$word',
  'Pa$$w0rd',
  'Passw0rd',
  'cocacola',
  'pepsi',
  'starbucks',
  'nike',
  'adidas',
  'fuckyou',
  'fuckoff',
  'bitch',
  'asshole',
  'shithead',
  'whatever',
  'nothing',
  'nopass',
  'nopassword',
  'blank',
  'null',
  'none',
]);

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export function validatePasswordStrength(value: string): string | null {
  if (!value) return 'Password is required';

  if (value.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }

  if (value.length > MAX_LENGTH) {
    return `Password must be at most ${MAX_LENGTH} characters`;
  }

  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(value)) {
    return 'Password is too common. Please choose a stronger password.';
  }

  if (new Set(value).size < 5) {
    return 'Password must contain at least 5 unique characters';
  }

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value);

  const classes = [hasUpper, hasLower, hasDigit, hasSpecial].filter(
    Boolean,
  ).length;
  if (classes < 3) {
    return 'Password must contain at least 3 of: uppercase, lowercase, digit, special character';
  }

  if (/(.)\1{3,}/.test(value)) {
    return 'Password must not contain 4 or more repeating characters in a row';
  }

  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      value,
    )
  ) {
    return 'Password must not contain sequential characters (e.g. abc, 123)';
  }

  return null;
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    const error = validatePasswordStrength(value);
    if (error) {
      (this as Record<string, unknown>)._lastError = error;
      return false;
    }
    return true;
  }

  defaultMessage() {
    const lastError = (this as Record<string, unknown>)._lastError as
      | string
      | undefined;
    return (
      lastError ??
      'Password is too weak. Use 8+ characters with mixed case, digits, and special characters.'
    );
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
