"""Root ASGI entrypoint.

This wrapper keeps compatibility with both `main:app` and `app.main:app` imports.
"""

from app.main import app


__all__ = ["app"]
