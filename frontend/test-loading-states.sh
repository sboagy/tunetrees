#!/bin/bash

# Manual test script for auth loading states
# This script uses curl to test the pages load correctly

echo "🧪 Testing TuneTrees Authentication Loading States"
echo "=================================================="

# Test login page loads
echo "📝 Testing login page..."
LOGIN_RESPONSE=$(curl -k -s -w "%{http_code}" https://localhost:3000/auth/login -o /tmp/login.html)
if [ "$LOGIN_RESPONSE" = "200" ]; then
    echo "✅ Login page loads successfully"
    # Check if our loading button is present
    if grep -q "data-testid=\"login-submit-button\"" /tmp/login.html; then
        echo "✅ Login submit button with test id found"
    else
        echo "❌ Login submit button test id not found"
    fi
    # Check if LoadingButton component is being used
    if grep -q "Signing In" /tmp/login.html; then
        echo "✅ Loading text pattern found in login form"
    fi
else
    echo "❌ Login page failed to load (HTTP $LOGIN_RESPONSE)"
fi

echo ""

# Test signup page loads  
echo "📝 Testing signup page..."
SIGNUP_RESPONSE=$(curl -k -s -w "%{http_code}" https://localhost:3000/auth/newuser -o /tmp/signup.html)
if [ "$SIGNUP_RESPONSE" = "200" ]; then
    echo "✅ Signup page loads successfully"
    # Check if our loading button is present
    if grep -q "data-testid=\"signup-submit-button\"" /tmp/signup.html; then
        echo "✅ Signup submit button with test id found"
    else
        echo "❌ Signup submit button test id not found"
    fi
    # Check if LoadingButton component is being used
    if grep -q "Creating Account" /tmp/signup.html; then
        echo "✅ Loading text pattern found in signup form"
    fi
else
    echo "❌ Signup page failed to load (HTTP $SIGNUP_RESPONSE)"
fi

echo ""

# Check for our new components in the build
echo "📝 Checking component files..."
if [ -f "components/ui/spinner.tsx" ]; then
    echo "✅ Spinner component exists"
else
    echo "❌ Spinner component missing"
fi

if [ -f "components/ui/loading-button.tsx" ]; then
    echo "✅ LoadingButton component exists"
else
    echo "❌ LoadingButton component missing"
fi

echo ""
echo "🎯 Manual Testing Instructions:"
echo "1. Visit https://localhost:3000/auth/login"
echo "2. Fill in email and password"
echo "3. Click 'Sign In' and observe:"
echo "   - Button text changes to 'Signing In...'"
echo "   - Spinner appears next to text"
echo "   - Button becomes disabled"
echo ""
echo "4. Visit https://localhost:3000/auth/newuser"
echo "5. Fill in all form fields"
echo "6. Click 'Sign Up' and observe:"
echo "   - Button text changes to 'Creating Account...'"
echo "   - Spinner appears next to text"
echo "   - Button becomes disabled"
echo ""
echo "7. Check social login buttons (if present) show 'Connecting...' state"

# Clean up temp files
rm -f /tmp/login.html /tmp/signup.html