require("@testing-library/jest-dom");

// Set up environment variables for testing
process.env.TT_API_BASE_URL = "http://localhost:8000";

// Optional strict console policy for cleaner CI logs and catching hidden issues.
// Use env flags when running tests:
//  - JEST_FAIL_ON_CONSOLE=true npm run test:unit    -> throw on unexpected console.error
//  - JEST_SILENCE_CONSOLE=true npm run test:unit    -> silence console logs (log/warn/error)
//
// Known/expected error patterns to allow during unit tests that simulate failures.
const allowedErrorPatterns = [
  /Failed to delete unverified user: Database error/,
  /Failed to send SMS verification:/,
  /SMS verification error:/,
];

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

if (process.env.JEST_SILENCE_CONSOLE === "true") {
  // Silence all logs
  // eslint-disable-next-line no-undef
  console.log = jest.fn();
  // eslint-disable-next-line no-undef
  console.warn = jest.fn();
  // eslint-disable-next-line no-undef
  console.error = jest.fn();
} else if (process.env.JEST_FAIL_ON_CONSOLE === "true") {
  // Fail tests on unexpected console.error calls
  beforeEach(() => {
    console.error = (...args) => {
      const text = args.map((a) => String(a)).join(" ");
      const allowed = allowedErrorPatterns.some((re) => re.test(text));
      if (!allowed) {
        // Echo the original message to aid debugging
        originalConsole.error.apply(console, args);
        throw new Error(`console.error called during test: ${text}`);
      }
      // Swallow known/expected errors to keep logs clean
    };
  });

  afterEach(() => {
    console.error = originalConsole.error;
  });
}
