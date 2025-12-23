from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager

from .config import Config
from .extensions import db
from .routes.health import bp as health_bp
from .routes.master import bp as master_bp
from .routes.cases import bp as cases_bp
from .routes.ai import bp as ai_bp
from .routes.auth import bp as auth_bp

def create_app():
    load_dotenv()  # load backend/.env
    Config.validate()

    app = Flask(__name__)

    app.config["JWT_SECRET_KEY"] = "your_jwt_secret_key"  # Change this to a secure key
    app.config["SQLALCHEMY_DATABASE_URI"] = Config.database_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, resources={r"/*": {"origins": "*"}})

    db.init_app(app)
    migrate = Migrate(app, db)
    jwt = JWTManager(app)

    app.register_blueprint(health_bp)
    app.register_blueprint(master_bp)
    app.register_blueprint(cases_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(auth_bp)

    return app
