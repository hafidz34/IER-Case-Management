from sqlalchemy import func, select
from ..extensions import db
from ..models import Case, StatusPengajuan

def get_case_stats():
    total = db.session.scalar(select(func.count(Case.id))) or 0
    stmt = (
        select(StatusPengajuan.name, func.count(Case.id))
        .select_from(StatusPengajuan)
        .outerjoin(Case, StatusPengajuan.id == Case.status_pengajuan_id)
        .group_by(StatusPengajuan.name)
    )
    
    rows = db.session.execute(stmt).all()
    details = {row[0]: row[1] for row in rows}

    return {
        "total": total,
        "details": details
    }