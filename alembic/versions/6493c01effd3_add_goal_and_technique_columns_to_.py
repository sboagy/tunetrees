"""Add goal and technique columns to practice_record

Revision ID: 6493c01effd3
Revises: 8ed9decef389
Create Date: 2025-07-24 16:33:43.884471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6493c01effd3'
down_revision: Union[str, Sequence[str], None] = '8ed9decef389'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add goal and technique columns to practice_record table.
    
    These columns store the practice goal and technique used for each
    practice session, enabling better historical analysis and scheduling.
    """
    # Add goal column with default value 'recall'
    op.add_column('practice_record', sa.Column('goal', sa.Text(), nullable=True, default='recall'))
    
    # Add technique column (nullable, no default)
    op.add_column('practice_record', sa.Column('technique', sa.Text(), nullable=True))
    
    # Set default value for existing records
    op.execute("UPDATE practice_record SET goal = 'recall' WHERE goal IS NULL")


def downgrade() -> None:
    """Remove goal and technique columns from practice_record table."""
    op.drop_column('practice_record', 'technique')
    op.drop_column('practice_record', 'goal')
