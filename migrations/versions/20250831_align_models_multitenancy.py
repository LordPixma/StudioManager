"""Align schema with multi-tenant models

Revision ID: 20250831_align_models_multitenancy
Revises: faf7ea481b6f
Create Date: 2025-08-31

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250831_align_models_multitenancy'
down_revision = 'faf7ea481b6f'
branch_labels = None
depends_on = None


def upgrade():
    # Tenants table
    op.create_table(
        'tenants',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('subdomain', sa.String(length=50), nullable=False, unique=True),
        sa.Column('plan', sa.String(length=20), nullable=False, server_default='free'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('settings', sa.JSON(), nullable=True),
    )

    # Add tenant_id to studios
    with op.batch_alter_table('studios') as batch:
        batch.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('address', sa.Text(), nullable=True))
        batch.add_column(sa.Column('phone', sa.String(length=20), nullable=True))
        batch.add_column(sa.Column('email', sa.String(length=120), nullable=True))
        batch.add_column(sa.Column('settings', sa.JSON(), nullable=True))
        batch.create_foreign_key('fk_studios_tenant', 'tenants', ['tenant_id'], ['id'])
        batch.create_index('ix_studios_tenant', ['tenant_id'])

    # Users table adjustments
    with op.batch_alter_table('users') as batch:
        batch.alter_column('password_hash', type_=sa.String(length=255), existing_nullable=False)
        batch.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        batch.add_column(sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch.create_foreign_key('fk_users_tenant', 'tenants', ['tenant_id'], ['id'])
        batch.create_index('ix_users_tenant', ['tenant_id'])
        # Drop global unique(email) if exists and add composite unique
        try:
            batch.drop_constraint('users_email_key', type_='unique')
        except Exception:
            pass
        batch.create_unique_constraint('_tenant_user_email_uc', ['tenant_id', 'email'])

    # Customers table adjustments
    with op.batch_alter_table('customers') as batch:
        batch.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_customers_tenant', 'tenants', ['tenant_id'], ['id'])
        batch.create_index('ix_customers_tenant', ['tenant_id'])
        # Remove global unique(email) if exists, create composite unique
        try:
            batch.drop_constraint('customers_email_key', type_='unique')
        except Exception:
            pass
        batch.create_unique_constraint('_tenant_customer_email_uc', ['tenant_id', 'email'])

    # Rooms table
    op.create_table(
        'rooms',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('studio_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('hourly_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('equipment', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['studio_id'], ['studios.id'])
    )
    op.create_index('ix_rooms_tenant', 'rooms', ['tenant_id'])
    op.create_index('ix_rooms_studio', 'rooms', ['studio_id'])

    # Bookings table
    op.create_table(
        'bookings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='confirmed'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'])
    )
    op.create_index('ix_bookings_tenant', 'bookings', ['tenant_id'])
    op.create_index('ix_bookings_room', 'bookings', ['room_id'])
    op.create_index('ix_bookings_time', 'bookings', ['start_time', 'end_time'])

    # Backfill: set tenant_id where nullable columns were added (optional, leave to ops script)


def downgrade():
    # Drop bookings
    op.drop_index('ix_bookings_time', table_name='bookings')
    op.drop_index('ix_bookings_room', table_name='bookings')
    op.drop_index('ix_bookings_tenant', table_name='bookings')
    op.drop_table('bookings')

    # Drop rooms
    op.drop_index('ix_rooms_studio', table_name='rooms')
    op.drop_index('ix_rooms_tenant', table_name='rooms')
    op.drop_table('rooms')

    # Customers adjustments revert
    with op.batch_alter_table('customers') as batch:
        try:
            batch.drop_constraint('_tenant_customer_email_uc', type_='unique')
        except Exception:
            pass
        try:
            batch.create_unique_constraint('customers_email_key', ['email'])
        except Exception:
            pass
        try:
            batch.drop_index('ix_customers_tenant')
        except Exception:
            pass
        try:
            batch.drop_constraint('fk_customers_tenant', type_='foreignkey')
        except Exception:
            pass
        try:
            batch.drop_column('tenant_id')
        except Exception:
            pass

    # Users adjustments revert
    with op.batch_alter_table('users') as batch:
        try:
            batch.drop_constraint('_tenant_user_email_uc', type_='unique')
        except Exception:
            pass
        try:
            batch.create_unique_constraint('users_email_key', ['email'])
        except Exception:
            pass
        try:
            batch.drop_index('ix_users_tenant')
        except Exception:
            pass
        try:
            batch.drop_constraint('fk_users_tenant', type_='foreignkey')
        except Exception:
            pass
        for col in ('tenant_id', 'is_active', 'created_at'):
            try:
                batch.drop_column(col)
            except Exception:
                pass

    # Studios adjustments revert
    with op.batch_alter_table('studios') as batch:
        for ix in ('ix_studios_tenant',):
            try:
                batch.drop_index(ix)
            except Exception:
                pass
        for cons in ('fk_studios_tenant',):
            try:
                batch.drop_constraint(cons, type_='foreignkey')
            except Exception:
                pass
        for col in ('tenant_id', 'address', 'phone', 'email', 'settings'):
            try:
                batch.drop_column(col)
            except Exception:
                pass

    # Tenants table
    op.drop_table('tenants')
