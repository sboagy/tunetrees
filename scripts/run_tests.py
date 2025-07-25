#!/usr/bin/env python3
"""
Clean test runner script with improved resource cleanup.
"""

import subprocess
import sys
import gc
import threading
from pathlib import Path


def run_backend_tests():
    """Run backend tests with proper cleanup."""
    print("Running backend tests...")

    # Change to the project root directory
    project_root = Path(__file__).parent

    try:
        # Run pytest
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/", "-v"],
            cwd=project_root,
            capture_output=False,
            text=True,
        )

        # Force cleanup
        gc.collect()

        print(f"\nTests completed with exit code: {result.returncode}")
        print(f"Active threads: {threading.active_count()}")

        return result.returncode

    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        return 1
    except Exception as e:
        print(f"Error running tests: {e}")
        return 1


if __name__ == "__main__":
    exit_code = run_backend_tests()
    sys.exit(exit_code)
