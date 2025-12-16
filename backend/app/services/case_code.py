from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from ..models import Case

JAKARTA = ZoneInfo("Asia/Jakarta")

def make_base(dt: datetime) -> str:
    # format sesuai contoh kamu: D + M + YYYY (tanpa leading zero)
    return f"{dt.day}{dt.month}{dt.year}"

def next_case_code(session) -> str:
    now = datetime.now(JAKARTA)
    base = make_base(now)

    # lock per-base biar aman kalau 2 request barengan di hari yg sama
    session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": base})

    rows = session.execute(
        select(Case.case_code).where(Case.case_code.like(f"{base}%"))
    ).scalars().all()

    max_seq = 0
    for code in rows:
        suffix = code[len(base):]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))

    return f"{base}{max_seq + 1}"