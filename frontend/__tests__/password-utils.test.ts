/**
 * Unit tests for password validation utilities
 * Tests the password strength calculation and validation logic
 */
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthProgressColor,
  isPasswordValid,
  PASSWORD_REQUIREMENTS,
} from '@/lib/password-utils';

describe('Password Validation Utils', () => {
  describe('PASSWORD_REQUIREMENTS', () => {
    it('should have 5 requirements', () => {
      expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
    });

    it('should test minimum length requirement', () => {
      const minLengthReq = PASSWORD_REQUIREMENTS.find(req => req.id === 'minLength');
      expect(minLengthReq).toBeDefined();
      expect(minLengthReq!.test('1234567')).toBe(false); // 7 chars
      expect(minLengthReq!.test('12345678')).toBe(true); // 8 chars
      expect(minLengthReq!.test('123456789')).toBe(true); // 9 chars
    });

    it('should test uppercase requirement', () => {
      const uppercaseReq = PASSWORD_REQUIREMENTS.find(req => req.id === 'uppercase');
      expect(uppercaseReq).toBeDefined();
      expect(uppercaseReq!.test('password')).toBe(false);
      expect(uppercaseReq!.test('Password')).toBe(true);
      expect(uppercaseReq!.test('PASSWORD')).toBe(true);
    });

    it('should test lowercase requirement', () => {
      const lowercaseReq = PASSWORD_REQUIREMENTS.find(req => req.id === 'lowercase');
      expect(lowercaseReq).toBeDefined();
      expect(lowercaseReq!.test('PASSWORD')).toBe(false);
      expect(lowercaseReq!.test('Password')).toBe(true);
      expect(lowercaseReq!.test('password')).toBe(true);
    });

    it('should test number requirement', () => {
      const numberReq = PASSWORD_REQUIREMENTS.find(req => req.id === 'number');
      expect(numberReq).toBeDefined();
      expect(numberReq!.test('Password')).toBe(false);
      expect(numberReq!.test('Password1')).toBe(true);
      expect(numberReq!.test('123456')).toBe(true);
    });

    it('should test special character requirement', () => {
      const specialReq = PASSWORD_REQUIREMENTS.find(req => req.id === 'special');
      expect(specialReq).toBeDefined();
      expect(specialReq!.test('Password1')).toBe(false);
      expect(specialReq!.test('Password1!')).toBe(true);
      expect(specialReq!.test('Password@123')).toBe(true);
      expect(specialReq!.test('Pass#word')).toBe(true);
    });
  });

  describe('calculatePasswordStrength', () => {
    it('should return weak strength for empty password', () => {
      const result = calculatePasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.level).toBe('weak');
      expect(result.percentage).toBe(0);
      expect(result.requirements).toHaveLength(5);
      expect(result.requirements.every(req => !req.met)).toBe(true);
    });

    it('should return weak strength for password meeting 0-2 requirements', () => {
      const result1 = calculatePasswordStrength('pass'); // 0 requirements (too short)
      expect(result1.level).toBe('weak');
      
      const result2 = calculatePasswordStrength('password'); // 2 requirements (length + lowercase)
      expect(result2.level).toBe('weak');
      expect(result2.score).toBe(2);

      const result3 = calculatePasswordStrength('Password'); // 3 requirements (length + lowercase + uppercase)
      expect(result3.level).toBe('medium');
      expect(result3.score).toBe(3);
    });

    it('should return medium strength for password meeting 3-4 requirements', () => {
      const result1 = calculatePasswordStrength('Password1'); // 4 requirements (length + lowercase + uppercase + number)
      expect(result1.level).toBe('medium');
      expect(result1.score).toBe(4);
      expect(result1.percentage).toBe(80);

      const result2 = calculatePasswordStrength('Password1!'); // 5 requirements (all)
      expect(result2.level).toBe('strong');
      expect(result2.score).toBe(5);
      expect(result2.percentage).toBe(100);
    });

    it('should return strong strength for password meeting all 5 requirements', () => {
      const result = calculatePasswordStrength('Password1!'); // All 5 requirements
      expect(result.level).toBe('strong');
      expect(result.score).toBe(5);
      expect(result.percentage).toBe(100);
      expect(result.requirements.every(req => req.met)).toBe(true);
    });

    it('should correctly identify which requirements are met', () => {
      const result = calculatePasswordStrength('MyPass123!');
      const requirementsMet = result.requirements.filter(req => req.met).map(req => req.id);
      
      expect(requirementsMet).toContain('minLength');
      expect(requirementsMet).toContain('uppercase');
      expect(requirementsMet).toContain('lowercase');
      expect(requirementsMet).toContain('number');
      expect(requirementsMet).toContain('special');
    });

    it('should handle edge cases for special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;\':"\\,.<>/?';
      for (const char of specialChars) {
        const password = `Password1${char}`;
        const result = calculatePasswordStrength(password);
        const specialReq = result.requirements.find(req => req.id === 'special');
        expect(specialReq?.met).toBe(true);
      }
    });
  });

  describe('getStrengthColor', () => {
    it('should return correct colors for each strength level', () => {
      expect(getStrengthColor('weak')).toBe('text-red-500');
      expect(getStrengthColor('medium')).toBe('text-yellow-500');
      expect(getStrengthColor('strong')).toBe('text-green-500');
    });

    it('should return default color for invalid level', () => {
      // @ts-expect-error Testing invalid input
      expect(getStrengthColor('invalid')).toBe('text-gray-400');
    });
  });

  describe('getStrengthProgressColor', () => {
    it('should return correct background colors for each strength level', () => {
      expect(getStrengthProgressColor('weak')).toBe('bg-red-500');
      expect(getStrengthProgressColor('medium')).toBe('bg-yellow-500');
      expect(getStrengthProgressColor('strong')).toBe('bg-green-500');
    });

    it('should return default color for invalid level', () => {
      // @ts-expect-error Testing invalid input
      expect(getStrengthProgressColor('invalid')).toBe('bg-gray-300');
    });
  });

  describe('isPasswordValid', () => {
    it('should return false for passwords not meeting minimum requirements', () => {
      expect(isPasswordValid('')).toBe(false);
      expect(isPasswordValid('pass')).toBe(false);
      expect(isPasswordValid('password')).toBe(false); // only 2 requirements
      expect(isPasswordValid('Password')).toBe(true); // 3 requirements - should be valid
    });

    it('should return true for passwords meeting minimum requirements (3+ requirements)', () => {
      expect(isPasswordValid('Password1')).toBe(true); // 3 requirements: length, upper, lower, number
      expect(isPasswordValid('Password1!')).toBe(true); // 4 requirements
      expect(isPasswordValid('MyStrongPass123!')).toBe(true); // All 5 requirements
    });

    it('should require at least medium strength (3+ requirements)', () => {
      // Test edge case: exactly 3 requirements should be valid
      expect(isPasswordValid('Abcdefgh')).toBe(true); // length + upper + lower = 3 requirements
      expect(isPasswordValid('abcdefgh')).toBe(false); // length + lower = 2 requirements (should be false)
    });
  });

  describe('Real-world password examples', () => {
    const testCases = [
      { password: 'password', expectedLevel: 'weak', expectedScore: 2 }, // length + lowercase
      { password: 'Password', expectedLevel: 'medium', expectedScore: 3 }, // length + lower + upper  
      { password: 'Password1', expectedLevel: 'medium', expectedScore: 4 }, // length + lower + upper + number
      { password: 'Password1!', expectedLevel: 'strong', expectedScore: 5 }, // all 5
      { password: 'MySecure123!', expectedLevel: 'strong', expectedScore: 5 }, // all 5
      { password: 'weakpass', expectedLevel: 'weak', expectedScore: 2 }, // length + lowercase
      { password: 'WEAKPASS', expectedLevel: 'weak', expectedScore: 2 }, // length + uppercase
      { password: '12345678', expectedLevel: 'weak', expectedScore: 2 }, // length + number
      { password: '!@#$%^&*', expectedLevel: 'weak', expectedScore: 2 }, // length + special
    ];

    testCases.forEach(({ password, expectedLevel, expectedScore }) => {
      it(`should correctly evaluate "${password}"`, () => {
        const result = calculatePasswordStrength(password);
        expect(result.level).toBe(expectedLevel);
        expect(result.score).toBe(expectedScore);
      });
    });
  });
});
