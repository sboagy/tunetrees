#!/usr/bin/env python3
"""
EMERGENCY SCRIPT: Add missing views to production database

Production database is missing 3 critical views:
- practice_list_joined
- practice_list_staged  
- view_playlist_joined

This script connects directly to production and creates them.
"""

import sqlite3
import sys

def add_views_to_database(db_path):
    """Add the missing views to the specified database."""
    print(f"🚨 EMERGENCY: Adding missing views to {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # View 1: view_playlist_joined
        cursor.execute("""
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
        print("✅ Created view: view_playlist_joined")

        # View 2: practice_list_joined
        cursor.execute("""
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
                COALESCE(practice_record.goal, 'recall') as goal,
                practice_record.technique,
                (
                    SELECT group_concat(tag.tag_text, ' ')
                    FROM tag
                    WHERE tag.tune_ref = tune.id
                      AND tag.user_ref = playlist.user_ref
                ) AS tags,
                playlist_tune.playlist_ref,
                playlist.user_ref,
                playlist_tune.deleted as playlist_deleted,
                (
                    SELECT group_concat(note.note_text, ' ')
                    FROM note
                    WHERE note.tune_ref = tune.id
                      AND note.user_ref = playlist.user_ref
                ) AS notes,
                (
                    SELECT ref.url
                    FROM reference ref
                    WHERE ref.tune_ref = tune.id
                      AND ref.user_ref = playlist.user_ref
                      AND ref.favorite = 1
                    LIMIT 1
                ) AS favorite_url,
                0 AS has_override
            FROM tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN (
                SELECT pr.*
                FROM practice_record pr
                INNER JOIN (
                    SELECT tune_ref, playlist_ref, MAX(id) as max_id
                    FROM practice_record
                    GROUP BY tune_ref, playlist_ref
                ) latest ON pr.tune_ref = latest.tune_ref
                        AND pr.playlist_ref = latest.playlist_ref
                        AND pr.id = latest.max_id
            ) practice_record ON practice_record.tune_ref = tune.id
                              AND practice_record.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN tag ON tag.tune_ref = tune.id
        """)
        print("✅ Created view: practice_list_joined")

        # View 3: practice_list_staged
        cursor.execute("""
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
                COALESCE(practice_record.goal, 'recall') as goal,
                practice_record.technique,
                (
                    SELECT group_concat(tag.tag_text, ' ')
                    FROM tag
                    WHERE tag.tune_ref = tune.id
                      AND tag.user_ref = playlist.user_ref
                ) AS tags,
                td.purpose AS purpose,
                td.note_private AS note_private,
                td.note_public AS note_public,
                td.recall_eval AS recall_eval,
                (
                    SELECT group_concat(note.note_text, ' ')
                    FROM note
                    WHERE note.tune_ref = tune.id
                      AND note.user_ref = playlist.user_ref
                ) AS notes,
                (
                    SELECT ref.url
                    FROM reference ref
                    WHERE ref.tune_ref = tune.id
                      AND ref.user_ref = playlist.user_ref
                      AND ref.favorite = 1
                    LIMIT 1
                ) AS favorite_url,
                0 AS has_override
            FROM tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
            LEFT JOIN (
                SELECT pr.*
                FROM practice_record pr
                INNER JOIN (
                    SELECT tune_ref, playlist_ref, MAX(id) as max_id
                    FROM practice_record
                    GROUP BY tune_ref, playlist_ref
                ) latest ON pr.tune_ref = latest.tune_ref
                        AND pr.playlist_ref = latest.playlist_ref
                        AND pr.id = latest.max_id
            ) practice_record ON practice_record.tune_ref = tune.id
                              AND practice_record.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN tag ON tag.tune_ref = tune.id
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id
                                               AND td.playlist_id = playlist_tune.playlist_ref
        """)
        print("✅ Created view: practice_list_staged")

        # Commit the changes
        conn.commit()
        print("✅ All views created and committed successfully!")
        
        # Verify views were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
        views = cursor.fetchall()
        print(f"📊 Database now has {len(views)} views:")
        for view in views:
            print(f"   - {view[0]}")
            
    except Exception as e:
        print(f"❌ Error creating views: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python emergency_fix_production_views.py <database_path>")
        print("Example: python emergency_fix_production_views.py tunetrees_production.sqlite3")
        sys.exit(1)
    
    db_path = sys.argv[1]
    add_views_to_database(db_path)
