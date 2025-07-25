"""emergency_add_missing_views

Revision ID: 00fb8fdf2293
Revises: 6493c01effd3
Create Date: 2025-07-24 22:29:33.883932

CRITICAL: This migration adds the 3 missing views that were never deployed to production.
Production database is missing these essential views:
- practice_list_joined
- practice_list_staged  
- view_playlist_joined

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Import view utilities from the local directory
import sys
import os
sys.path.insert(0, os.path.dirname(__file__) + "/..") 
from view_utils import create_views_from_target_db, drop_views


# revision identifiers, used by Alembic.
revision: str = '00fb8fdf2293'
down_revision: Union[str, Sequence[str], None] = '6493c01effd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the missing views to production database."""
    print("🚨 EMERGENCY: Adding missing views to production database")
    print("Creating 3 critical views: practice_list_joined, practice_list_staged, view_playlist_joined")
    
    # Create views using direct SQL - the same approach as working migrations
    op.execute("""
        CREATE VIEW view_playlist_joined AS
        SELECT
            p.playlist_id,
            p.user_ref,
            p.deleted AS playlist_deleted,
            p.instrument_ref,
            i.private_to_user,
            i.instrument,
            i.description,
            i.genre_default,
            i.deleted AS instrument_deleted
        FROM
            playlist p
            JOIN instrument i ON p.instrument_ref = i.id
    """)
    print("  - Created view: view_playlist_joined")

    op.execute("""
        CREATE VIEW practice_list_joined as
        SELECT
            tune.id AS id,
            tune.title AS title,
            tune.type AS type,
            tune.structure AS structure,
            tune.mode AS mode,
            tune.incipit AS incipit,
            tune.genre AS genre,
            tune.deleted,
            tune.private_for,
            playlist_tune.learned,
            practice_record.practiced,
            practice_record.quality,
            practice_record.easiness,
            practice_record.difficulty,
            practice_record.interval,
            practice_record.step,
            practice_record.repetitions,
            practice_record.review_date,
            practice_record.goal,
            practice_record.technique,
            (
                SELECT
                    group_concat (tag.tag_text, ' ')
                FROM
                    tag
                WHERE
                    tag.tune_ref = tune.id
                    AND tag.user_ref = playlist.user_ref
            ) AS tags,
            playlist_tune.playlist_ref,
            playlist.user_ref,
            playlist_tune.deleted as playlist_deleted,
            (
                SELECT
                    group_concat (note.note_text, ' ')
                FROM
                    note
                WHERE
                    note.tune_ref = tune.id
                    AND note.user_ref = playlist.user_ref
            ) AS notes,
            (
                SELECT
                    ref.url
                FROM
                    reference ref
                WHERE
                    ref.tune_ref = tune.id
                    AND ref.user_ref = playlist.user_ref
                    AND ref.favorite = 1
                LIMIT
                    1
            ) AS favorite_url,
            0 AS has_override
        FROM
            tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN (
                SELECT
                    pr.*
                FROM
                    practice_record pr
                    INNER JOIN (
                        SELECT
                            tune_ref,
                            playlist_ref,
                            MAX(id) as max_id
                        FROM
                            practice_record
                        GROUP BY
                            tune_ref,
                            playlist_ref
                    ) latest ON pr.tune_ref = latest.tune_ref
                    AND pr.playlist_ref = latest.playlist_ref
                    AND pr.id = latest.max_id
            ) practice_record ON practice_record.tune_ref = tune.id
            AND practice_record.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN tag ON tag.tune_ref = tune.id
    """)
    print("  - Created view: practice_list_joined")

    op.execute("""
        CREATE VIEW practice_list_staged as
        SELECT
            tune.id AS id,
            tune.title AS title,
            tune.type AS type,
            tune.structure AS structure,
            tune.mode AS mode,
            tune.incipit AS incipit,
            tune.genre AS genre,
            tune.private_for,
            tune.deleted,
            playlist_tune.learned,
            playlist.user_ref AS user_ref,
            playlist.playlist_id AS playlist_id,
            instrument.instrument AS instrument,
            playlist_tune.deleted as playlist_deleted,
            practice_record.practiced,
            practice_record.quality,
            practice_record.easiness,
            practice_record.difficulty,
            practice_record.interval,
            practice_record.step,
            practice_record.repetitions,
            practice_record.review_date,
            practice_record.backup_practiced,
            practice_record.goal,
            practice_record.technique,
            (
                SELECT
                    group_concat (tag.tag_text, ' ')
                FROM
                    tag
                WHERE
                    tag.tune_ref = tune.id
                    AND tag.user_ref = playlist.user_ref
            ) AS tags,
            td.purpose AS purpose,
            td.note_private AS note_private,
            td.note_public AS note_public,
            td.recall_eval AS recall_eval,
            (
                SELECT
                    group_concat (note.note_text, ' ')
                FROM
                    note
                WHERE
                    note.tune_ref = tune.id
                    AND note.user_ref = playlist.user_ref
            ) AS notes,
            (
                SELECT
                    ref.url
                FROM
                    reference ref
                WHERE
                    ref.tune_ref = tune.id
                    AND ref.user_ref = playlist.user_ref
                    AND ref.favorite = 1
                LIMIT
                    1
            ) AS favorite_url,
            0 AS has_override
        FROM
            tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
            LEFT JOIN (
                SELECT
                    pr.*
                FROM
                    practice_record pr
                    INNER JOIN (
                        SELECT
                            tune_ref,
                            playlist_ref,
                            MAX(id) as max_id
                        FROM
                            practice_record
                        GROUP BY
                            tune_ref,
                            playlist_ref
                    ) latest ON pr.tune_ref = latest.tune_ref
                    AND pr.playlist_ref = latest.playlist_ref
                    AND pr.id = latest.max_id
            ) practice_record ON practice_record.tune_ref = tune.id
            AND practice_record.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN tag ON tag.tune_ref = tune.id
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id
            AND td.playlist_id = playlist_tune.playlist_ref
    """)
    print("  - Created view: practice_list_staged")

    print("✅ Emergency view creation completed")


def downgrade() -> None:
    """Remove the views (for rollback if needed)."""
    print("⚠️  Removing views during downgrade")
    drop_views()
    print("✅ Views removed")
