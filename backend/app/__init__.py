from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv

from .config import Config
from .extensions import db
from .routes.health import bp as health_bp
from .routes.master import bp as master_bp
from .routes.cases import bp as cases_bp

def create_app():
    load_dotenv()  # load backend/.env
    Config.validate()

    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = Config.database_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, resources={r"/*": {"origins": "*"}})

    db.init_app(app)
    migrate = Migrate(app, db)

    app.register_blueprint(health_bp)
    app.register_blueprint(master_bp)
    app.register_blueprint(cases_bp)

    return app