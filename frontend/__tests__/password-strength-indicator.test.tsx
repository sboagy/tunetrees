/**
 * Integration test for PasswordStrengthIndicator component
 * Tests the React component rendering and user interaction
 */
import { render } from '@testing-library/react';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';

describe('PasswordStrengthIndicator Component', () => {
  it('should render nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render component when password is provided', () => {
    const { container } = render(<PasswordStrengthIndicator password="test" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('should render component with showRequirements false', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Password1" showRequirements={false} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('should render component with various password strengths', () => {
    const passwords = ['weak', 'Password1', 'StrongPass123!'];
    
    passwords.forEach(password => {
      const { container } = render(<PasswordStrengthIndicator password={password} />);
      expect(container.firstChild).not.toBeNull();
    });
  });
});