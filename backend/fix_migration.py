import re

file_path = "/Users/cleave/Desktop/PROJECTS/verifine/backend/alembic/versions/94026c6e23a6_multi_tenancy_upgrade.py"

with open(file_path, "r") as f:
    content = f.read()

# Insert the Default Organization right after creating the organization table
org_insert = """
    # Backfill Logic
    import uuid
    default_org_id = str(uuid.uuid4())
    op.execute(f"INSERT INTO organization (id, name, slug, base_currency_code, is_active, created_at) VALUES ('{default_org_id}', 'Default Org', 'default-{default_org_id[:8]}', 'NGN', true, now())")
"""

content = re.sub(
    r"(op\.create_index\(op\.f\('ix_organization_slug'\).*?\n)",
    r"\1" + org_insert + "\n",
    content,
)

# For every add_column with org_id and nullable=False
tables = [
    "account",
    "bill",
    "billlineitem",
    "companysettings",
    "customer",
    "exchangerate",
    "fiscalperiod",
    "invoice",
    "invoicelineitem",
    "journalentry",
    "ledgerline",
    "user",
    "vendor",
]

for table in tables:
    pattern = rf"op\.add_column\('{table}', sa\.Column\('org_id', sa\.Uuid\(\), nullable=False\)\)"
    replacement = f"""op.add_column('{table}', sa.Column('org_id', sa.Uuid(), nullable=True))
    op.execute(f"UPDATE {table} SET org_id = '{{default_org_id}}'")
    op.alter_column('{table}', 'org_id', nullable=False)"""
    content = re.sub(pattern, replacement, content)

with open(file_path, "w") as f:
    f.write(content)

print("Migration patched successfully.")
