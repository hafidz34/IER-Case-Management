from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from ..models import User
from ..extensions import db

bp = Blueprint("auth", __name__, url_prefix="/auth")

@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        # Buat token akses (bisa diatur kedaluwarsanya, default 15 menit/1 jam)
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token), 200
    
    return jsonify({"msg": "Username atau password salah"}), 401

# Route sementara untuk bikin user pertama (hapus nanti kalau sudah dipakai)
@bp.route("/register-seed", methods=["POST"])
def register_seed():
    data = request.get_json()
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"msg": "User sudah ada"}), 400
        
    user = User(username=data["username"])
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "User created"}), 201