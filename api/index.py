import os
import sys

# Ensure backend package is importable
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app import app  # Flask app instance

# Expose Flask app for Vercel Python runtime
__all__ = ["app"]
