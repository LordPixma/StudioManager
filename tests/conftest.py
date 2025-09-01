﻿# PyTest configuration and fixtures
import os
import sys

# Ensure repository root is on sys.path so 'app' package is importable in CI
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if REPO_ROOT not in sys.path:
	sys.path.insert(0, REPO_ROOT)
