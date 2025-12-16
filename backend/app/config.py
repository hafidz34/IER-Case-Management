import os

class Config:
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    @staticmethod
    def database_url() -> str:
        return os.environ.get("DATABASE_URL", "").strip()

    @staticmethod
    def validate():
        if not Config.database_url():
            raise RuntimeError("DATABASE_URL is not set. Put it in backend/.env")