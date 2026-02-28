"""multi_currency_upgrade

Revision ID: c2dd1e828db0
Revises: 08cda1344f68
Create Date: 2026-02-28 11:13:06.978703

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'c2dd1e828db0'
down_revision: Union[str, Sequence[str], None] = '08cda1344f68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('companysettings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('base_currency_code', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('is_base_currency_locked', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Add new columns with server defaults for existing rows
    op.add_column('bill', sa.Column('currency_code', sqlmodel.sql.sqltypes.AutoString(), server_default='NGN', nullable=False))
    op.add_column('bill', sa.Column('exchange_rate', sa.Float(), server_default='1.0', nullable=False))
    op.add_column('bill', sa.Column('base_total_amount', sa.Float(), server_default='0.0', nullable=False))
    
    op.add_column('billlineitem', sa.Column('base_amount', sa.Float(), server_default='0.0', nullable=False))
    
    op.add_column('invoice', sa.Column('currency_code', sqlmodel.sql.sqltypes.AutoString(), server_default='NGN', nullable=False))
    op.add_column('invoice', sa.Column('exchange_rate', sa.Float(), server_default='1.0', nullable=False))
    op.add_column('invoice', sa.Column('base_total_amount', sa.Float(), server_default='0.0', nullable=False))
    
    op.add_column('invoicelineitem', sa.Column('base_amount', sa.Float(), server_default='0.0', nullable=False))
    
    op.add_column('ledgerline', sa.Column('currency_code', sqlmodel.sql.sqltypes.AutoString(), server_default='NGN', nullable=False))
    op.add_column('ledgerline', sa.Column('exchange_rate', sa.Float(), server_default='1.0', nullable=False))
    op.add_column('ledgerline', sa.Column('transaction_debit', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('ledgerline', sa.Column('transaction_credit', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('ledgerline', sa.Column('base_debit', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('ledgerline', sa.Column('base_credit', sa.Float(), server_default='0.0', nullable=False))

    # Data Migration
    op.execute("UPDATE bill SET base_total_amount = total_amount")
    op.execute("UPDATE billlineitem SET base_amount = amount")
    op.execute("UPDATE invoice SET base_total_amount = total_amount")
    op.execute("UPDATE invoicelineitem SET base_amount = amount")
    op.execute("UPDATE ledgerline SET base_debit = debit, transaction_debit = debit, base_credit = credit, transaction_credit = credit")

    # Drop old columns
    op.drop_column('ledgerline', 'debit')
    op.drop_column('ledgerline', 'credit')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('ledgerline', sa.Column('credit', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('ledgerline', sa.Column('debit', sa.Float(), server_default='0.0', nullable=False))
    
    op.execute("UPDATE ledgerline SET debit = base_debit, credit = base_credit")

    op.drop_column('ledgerline', 'base_credit')
    op.drop_column('ledgerline', 'base_debit')
    op.drop_column('ledgerline', 'transaction_credit')
    op.drop_column('ledgerline', 'transaction_debit')
    op.drop_column('ledgerline', 'exchange_rate')
    op.drop_column('ledgerline', 'currency_code')
    op.drop_column('invoicelineitem', 'base_amount')
    op.drop_column('invoice', 'base_total_amount')
    op.drop_column('invoice', 'exchange_rate')
    op.drop_column('invoice', 'currency_code')
    op.drop_column('billlineitem', 'base_amount')
    op.drop_column('bill', 'base_total_amount')
    op.drop_column('bill', 'exchange_rate')
    op.drop_column('bill', 'currency_code')
    op.drop_table('companysettings')
