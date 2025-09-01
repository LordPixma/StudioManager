"""No-op migration to resolve duplicate heads after introducing a short revision ID.

Revision ID: a1b2c3d4e5f7
Revises: a1b2c3d4e5f6
Create Date: 2025-08-31

"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally no-op; all changes live in a1b2c3d4e5f6
    pass


def downgrade():
    # Intentionally no-op; nothing to revert here
    pass
