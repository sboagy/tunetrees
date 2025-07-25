#!/usr/bin/env python3
"""
Script to create a proper baseline migration from production database.
This generates CREATE TABLE statements by reflecting the production database schema.
"""

from datetime import datetime

from sqlalchemy import MetaData, create_engine
from sqlalchemy.schema import CreateTable

# Connect to production database
engine = create_engine("sqlite:///temp_production_for_baseline.sqlite3")
metadata = MetaData()

# Reflect all tables from production database
metadata.reflect(bind=engine)

print(f"Found {len(metadata.tables)} tables in production database:")
for table_name in metadata.tables.keys():
    print(f"  - {table_name}")

# Generate the migration file content
migration_content = f'''"""baseline from actual production schema

Revision ID: 20011a33cdb1
Revises: 
Create Date: {datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Import view utilities
import sys
import os
sys.path.insert(0, os.path.dirname(__file__) + "/..")
from view_utils import create_views, drop_views


# revision identifiers, used by Alembic.
revision: str = '20011a33cdb1'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade to baseline schema - creates all production tables."""
'''

# Add CREATE TABLE statements for each table
for table_name, table in metadata.tables.items():
    # Generate CREATE TABLE statement
    create_stmt = CreateTable(table).compile(engine)

    # Convert to Alembic op.create_table format
    columns = []
    for column in table.columns:
        col_type = str(column.type)
        nullable = not column.nullable

        if column.primary_key:
            if hasattr(column.type, "python_type") and column.type.python_type == int:
                columns.append(
                    f"sa.Column('{column.name}', sa.Integer(), nullable=False, primary_key=True)"
                )
            else:
                columns.append(
                    f"sa.Column('{column.name}', sa.{col_type}(), nullable=False, primary_key=True)"
                )
        else:
            columns.append(
                f"sa.Column('{column.name}', sa.{col_type}(), nullable={not nullable})"
            )

    migration_content += f"""
    # Table: {table_name}
    op.create_table('{table_name}',
        {chr(10).join("        " + col + "," for col in columns)}
    )
"""

migration_content += '''
    # Create views from production database
    create_views()


def downgrade() -> None:
    """Downgrade from baseline schema - drops all tables."""
    # Drop views first
    drop_views()
    
'''

# Add DROP TABLE statements in reverse order
table_names = list(metadata.tables.keys())
table_names.reverse()

for table_name in table_names:
    migration_content += f"    op.drop_table('{table_name}')\n"

migration_content += """
"""

# Write the migration file
migration_file = "alembic/versions/20011a33cdb1_baseline_from_production.py"
with open(migration_file, "w") as f:
    f.write(migration_content)

print(f"\n✓ Baseline migration created: {migration_file}")
print(f"✓ Migration ID: 20011a33cdb1")
print(f"✓ Tables included: {len(metadata.tables)}")
