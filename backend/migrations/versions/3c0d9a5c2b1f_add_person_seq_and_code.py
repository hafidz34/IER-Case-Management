"""add person_seq and person_code to case person

Revision ID: 3c0d9a5c2b1f
Revises: da42841a9334
Create Date: 2025-12-19 16:20:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3c0d9a5c2b1f"
down_revision = "da42841a9334"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('t_case_person', schema=None) as batch_op:
        # batch_op.add_column(sa.Column('person_seq', sa.Integer(), nullable=True))
        # batch_op.add_column(sa.Column('person_code', sa.String(length=128), nullable=True))

    # Backfill untuk data yang sudah ada (urut berdasarkan id per-case)
    # op.execute(sa.text('''
        # WITH numbered AS (
            # SELECT id, case_id, ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY id) AS rn
            # FROM t_case_person
        # )
        # UPDATE t_case_person p
        # SET person_seq = numbered.rn
        # FROM numbered
        # WHERE p.id = numbered.id;
    # '''))

    # op.execute(sa.text('''
        # UPDATE t_case_person p
        # SET person_code = c.case_code || '/' || p.person_seq
        # FROM t_case c
        # WHERE p.case_id = c.id;
    # '''))

    # with op.batch_alter_table('t_case_person', schema=None) as batch_op:
        # batch_op.alter_column('person_seq', existing_type=sa.Integer(), nullable=False)
        # batch_op.alter_column('person_code', existing_type=sa.String(length=128), nullable=False)

        # batch_op.create_unique_constraint(
            # 'uq_case_person_case_id_person_seq',
            # ['case_id', 'person_seq'],
        # )
        # batch_op.create_unique_constraint(
            # 'uq_t_case_person_person_code',
            # ['person_code'],
        # )
        pass


def downgrade():
    with op.batch_alter_table('t_case_person', schema=None) as batch_op:
        batch_op.drop_constraint('uq_t_case_person_person_code', type_='unique')
        batch_op.drop_constraint('uq_case_person_case_id_person_seq', type_='unique')
        batch_op.drop_column('person_code')
        batch_op.drop_column('person_seq')
