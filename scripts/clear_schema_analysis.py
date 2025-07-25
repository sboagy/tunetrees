#!/bin/bash
"""
Clear Schema Analysis Tool
Analyzes only the meaningful differences between schemas, ignoring formatting.
"""

import sqlite3
import sys
from collections import defaultdict


def get_schema_structure(db_path):
    """Extract meaningful schema structure, ignoring formatting."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    schema = {"tables": {}, "views": {}, "indexes": {}}

    # Get tables and their columns
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    tables = [row[0] for row in cursor.fetchall()]

    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        schema["tables"][table] = {
            "columns": [
                (col[1], col[2], col[3], col[4], col[5]) for col in columns
            ],  # name, type, notnull, default, pk
        }

        # Get foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({table})")
        fks = cursor.fetchall()
        schema["tables"][table]["foreign_keys"] = fks

    # Get views
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
    views = [row[0] for row in cursor.fetchall()]
    schema["views"] = set(views)

    # Get indexes
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    )
    indexes = [row[0] for row in cursor.fetchall()]
    schema["indexes"] = set(indexes)

    conn.close()
    return schema


def compare_schemas(clean_path, production_path):
    """Compare two schemas and show meaningful differences."""
    print("🔍 CLEAR SCHEMA ANALYSIS")
    print("=" * 50)

    clean_schema = get_schema_structure(clean_path)
    prod_schema = get_schema_structure(production_path)

    differences_found = False

    # Compare tables
    print("\n📊 TABLE ANALYSIS:")
    clean_tables = set(clean_schema["tables"].keys())
    prod_tables = set(prod_schema["tables"].keys())

    missing_in_prod = clean_tables - prod_tables
    extra_in_prod = prod_tables - clean_tables

    if missing_in_prod:
        print(f"❌ Tables MISSING in production: {missing_in_prod}")
        differences_found = True
    if extra_in_prod:
        print(f"➕ Tables EXTRA in production: {extra_in_prod}")
        differences_found = True

    # Compare columns for common tables
    common_tables = clean_tables & prod_tables
    for table in sorted(common_tables):
        clean_cols = {col[0]: col for col in clean_schema["tables"][table]["columns"]}
        prod_cols = {col[0]: col for col in prod_schema["tables"][table]["columns"]}

        missing_cols = set(clean_cols.keys()) - set(prod_cols.keys())
        extra_cols = set(prod_cols.keys()) - set(clean_cols.keys())

        if missing_cols or extra_cols:
            print(f"\n📋 Table '{table}' column differences:")
            differences_found = True

        if missing_cols:
            print(f"  ❌ Missing columns: {missing_cols}")
            for col in missing_cols:
                col_info = clean_cols[col]
                print(
                    f"    - {col}: {col_info[1]} {'NOT NULL' if col_info[2] else 'NULL'}"
                )

        if extra_cols:
            print(f"  ➕ Extra columns: {extra_cols}")
            for col in extra_cols:
                col_info = prod_cols[col]
                print(
                    f"    + {col}: {col_info[1]} {'NOT NULL' if col_info[2] else 'NULL'}"
                )

    # Compare views
    print(f"\n👁️  VIEW ANALYSIS:")
    clean_views = clean_schema["views"]
    prod_views = prod_schema["views"]

    missing_views = clean_views - prod_views
    extra_views = prod_views - clean_views

    if missing_views:
        print(f"❌ Views MISSING in production: {sorted(missing_views)}")
        differences_found = True
    if extra_views:
        print(f"➕ Views EXTRA in production: {sorted(extra_views)}")
        differences_found = True
    if clean_views == prod_views and clean_views:
        print(f"✅ All {len(clean_views)} views match: {sorted(clean_views)}")

    # Compare indexes
    print(f"\n🔗 INDEX ANALYSIS:")
    clean_indexes = clean_schema["indexes"]
    prod_indexes = prod_schema["indexes"]

    missing_indexes = clean_indexes - prod_indexes
    extra_indexes = prod_indexes - clean_indexes

    if missing_indexes:
        print(f"❌ Indexes MISSING in production: {sorted(missing_indexes)}")
        differences_found = True
    if extra_indexes:
        print(f"➕ Indexes EXTRA in production: {sorted(extra_indexes)}")
        differences_found = True

    # Summary
    print(f"\n" + "=" * 50)
    print(f"📈 SUMMARY:")
    print(
        f"  Clean DB: {len(clean_tables)} tables, {len(clean_views)} views, {len(clean_indexes)} indexes"
    )
    print(
        f"  Prod DB:  {len(prod_tables)} tables, {len(prod_views)} views, {len(prod_indexes)} indexes"
    )

    if not differences_found:
        print(f"✅ SCHEMAS MATCH PERFECTLY!")
        return True
    else:
        print(f"❌ SCHEMAS HAVE DIFFERENCES!")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python clear_schema_analysis.py <clean_db> <production_db>")
        sys.exit(1)

    clean_db = sys.argv[1]
    prod_db = sys.argv[2]

    schemas_match = compare_schemas(clean_db, prod_db)
    sys.exit(0 if schemas_match else 1)
