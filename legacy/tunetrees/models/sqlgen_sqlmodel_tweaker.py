from pathlib import Path
import re
import sys


def replace_mapped_column(file_path: Path):
    with open(file_path, "r") as file:
        content = file.read()

    # Replace mapped_column with Field
    content = re.sub(
        r"mapped_column\(([^,]+),\s*([^,]+),\s*primary_key=True\)",
        r"Field(sa_column=Column(\1, \2, primary_key=True))",
        content,
    )
    content = re.sub(
        r"mapped_column\(([^,]+),\s*([^,]+),\s*server_default=text\('NULL'\)\)",
        r"Field(sa_column=Column(\1, \2, server_default=text('NULL')))",
        content,
    )
    content = re.sub(
        r"mapped_column\(([^,]+),\s*ForeignKey\('([^']+)'\),\s*primary_key=True,\s*nullable=False\)",
        r"Field(sa_column=Column(\1, ForeignKey('\2'), primary_key=True, nullable=False))",
        content,
    )
    content = re.sub(
        r"mapped_column\(([^,]+),\s*([^,]+)\)",
        r"Field(sa_column=Column(\1, \2))",
        content,
    )

    # Fix relationship definitions
    content = re.sub(
        r"(\w+): List\['(\w+)'\] = Relationship\(back_populates='(\w+)'\)",
        r"\1: List['\2'] = Relationship(back_populates='\3')",
        content,
    )

    # Fix any remaining syntax issues
    content = re.sub(
        r"Field\(default=None, sa_column=Field\(default=None, sa_column=Column\(",
        r"Field(sa_column=Column(",
        content,
    )

    with open(file_path, "w") as file:
        file.write(content)


def main():
    if len(sys.argv) != 2:
        print("Usage: python sqlgen_sqlmodel_tweaker.py <filename>")
        sys.exit(1)

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"File {file_path} does not exist")
        sys.exit(1)

    replace_mapped_column(file_path)


if __name__ == "__main__":
    main()
