"""Remove old 2-column practice record constraint

Revision ID: 8ed9decef389
Revises: 5177d109a595
Create Date: 2025-07-24 15:33:13.034504

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ed9decef389'
down_revision: Union[str, Sequence[str], None] = '5177d109a595'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the old 2-column unique constraint on practice_record.
    
    The previous migration (6852fb7949e0) added the correct 3-column constraint
    but failed to remove the old 2-column constraint. This causes UNIQUE
    constraint violations when trying to create multiple practice records
    for the same tune in the same playlist.
    
    We'll use raw SQL to ensure exact control over the table structure.
    """
    # Clean up any leftover tables from previous failed attempts
    op.execute("DROP TABLE IF EXISTS practice_record_new")
    
    # Create new table with exact structure matching tunetrees_test_clean.sqlite3
    op.execute("""
        CREATE TABLE practice_record_new (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            playlist_ref INTEGER REFERENCES playlist(playlist_id),
            tune_ref INTEGER REFERENCES tune(id),
            practiced TEXT,
            quality INTEGER,
            easiness REAL,
            interval INTEGER,
            repetitions INTEGER,
            review_date TEXT,
            backup_practiced TEXT,
            stability REAL,
            elapsed_days INTEGER,
            lapses INTEGER,
            state INTEGER,
            difficulty REAL,
            step INTEGER,
            -- Only the correct 3-column unique constraint
            CONSTRAINT practice_record_unique_tune_playlist_practiced UNIQUE (tune_ref, playlist_ref, practiced)
        )
    """)
    
    # Copy data from old table to new table
    op.execute("""
        INSERT INTO practice_record_new 
        SELECT id, playlist_ref, tune_ref, practiced, quality, easiness, interval, 
               repetitions, review_date, backup_practiced, stability, elapsed_days, 
               lapses, state, difficulty, step
        FROM practice_record
    """)
    
    # Drop old table 
    op.execute("DROP TABLE practice_record")
    
    # Rename new table
    op.execute("ALTER TABLE practice_record_new RENAME TO practice_record")
    
    # Create the required indexes
    op.execute("CREATE INDEX practice_record_id_index ON practice_record (id)")
    op.execute("CREATE INDEX practice_record_practiced_index ON practice_record (practiced)")
    op.execute("CREATE INDEX practice_record_tune_playlist_practiced_index ON practice_record (tune_ref, playlist_ref, practiced)")


def downgrade() -> None:
    """Recreate the old problematic 2-column constraint.
    
    This downgrade is mainly for testing purposes and should not be used
    in production as it will reintroduce the constraint violation bug.
    """
    # Create table with both old and new constraints (problematic state)
    op.create_table('practice_record_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playlist_ref', sa.Integer(), nullable=True),
        sa.Column('tune_ref', sa.Integer(), nullable=True),
        sa.Column('practiced', sa.Text(), nullable=True),
        sa.Column('quality', sa.Integer(), nullable=True),
        sa.Column('easiness', sa.Float(), nullable=True),
        sa.Column('interval', sa.Integer(), nullable=True),
        sa.Column('repetitions', sa.Integer(), nullable=True),
        sa.Column('review_date', sa.Text(), nullable=True),
        sa.Column('backup_practiced', sa.Text(), nullable=True),
        sa.Column('stability', sa.Float(), nullable=True),
        sa.Column('elapsed_days', sa.Integer(), nullable=True),
        sa.Column('lapses', sa.Integer(), nullable=True),
        sa.Column('state', sa.Integer(), nullable=True),
        sa.Column('difficulty', sa.Float(), nullable=True),
        sa.Column('step', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['playlist_ref'], ['playlist.playlist_id'], ),
        sa.ForeignKeyConstraint(['tune_ref'], ['tune.id'], ),
        sa.PrimaryKeyConstraint('id'),
        # Both constraints (problematic)
        sa.UniqueConstraint('tune_ref', 'playlist_ref'),  # Old problematic constraint
        sa.UniqueConstraint('tune_ref', 'playlist_ref', 'practiced', name='practice_record_unique_tune_playlist_practiced')
    )
    
    # Copy data back
    op.execute("""
        INSERT INTO practice_record_old 
        SELECT id, playlist_ref, tune_ref, practiced, quality, easiness, interval, 
               repetitions, review_date, backup_practiced, stability, elapsed_days, 
               lapses, state, difficulty, step
        FROM practice_record
    """)
    
    # Drop current table and rename
    op.drop_table('practice_record')
    op.rename_table('practice_record_old', 'practice_record')
    
    # Recreate indexes on the renamed table
    op.create_index('practice_record_id_index', 'practice_record', ['id'], unique=False)
    op.create_index('practice_record_practiced_index', 'practice_record', ['practiced'], unique=False)
    op.create_index('practice_record_tune_playlist_practiced_index', 'practice_record', ['tune_ref', 'playlist_ref', 'practiced'], unique=False)
