from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from ..models import Case

JAKARTA = ZoneInfo("Asia/Jakarta")

def make_base(dt: datetime) -> str:
    # format sesuai requirement terbaru: dd/mm/yyyy
    return dt.strftime("%d/%m/%Y")

def next_case_code(session) -> str:
    now = datetime.now(JAKARTA)
    base = make_base(now)

    # lock per-base biar aman kalau 2 request barengan di hari yg sama
    session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": base})

    # cari semua ID yang base-nya sama (hari yang sama)
    rows = session.execute(
        select(Case.case_code).where(Case.case_code.like(f"{base}/%"))
    ).scalars().all()

    max_seq = 0
    for code in rows:
        # format global: dd/mm/yyyy/<seq>
        if not code.startswith(base + "/"):
            continue

        suffix = code[len(base) + 1 :]
        seq_str = suffix.split("/", 1)[0]
        if seq_str.isdigit():
            max_seq = max(max_seq, int(seq_str))

    return f"{base}/{max_seq + 1}"
