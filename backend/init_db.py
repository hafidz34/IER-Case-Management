import sys
from sqlalchemy import text

from app import create_app
from app.extensions import db
from app.seed import seed_all

app = create_app()
RESET = "--reset" in sys.argv


def reset_schema():
    """Reset database schema safely (supports PostgreSQL FK cascades)."""
    engine = db.engine
    dialect = engine.dialect.name

    if dialect == "postgresql":
        # Drop & recreate schema public (CASCADE drops dependent objects like FKs, views, etc.)
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
        return

    # Fallback: try standard SQLAlchemy drop_all (works for SQLite and many simple setups)
    db.drop_all()


with app.app_context():
    if RESET:
        reset_schema()

    db.create_all()
    report = seed_all()

    print("✅ DB initialized & seeded:")
    for k, v in report.items():
        print(f"- {k}: +{v}")

    if RESET:
        print("✅ Schema reset applied (reset_schema -> create_all).")