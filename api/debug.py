"""诊断端点 — 部署成功后删除"""
import sys, os, traceback

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from flask import Flask, jsonify
app = Flask(__name__)

@app.route("/api/debug")
def debug():
    info = {"python": sys.version, "cwd": os.getcwd(), "root": ROOT}
    errors = []
    for mod in ["flask_limiter", "psycopg2", "config_loader", "checker", "api_keys"]:
        try:
            __import__(mod)
            info[mod] = "ok"
        except Exception as e:
            info[mod] = f"FAIL: {e}"
            errors.append(f"{mod}: {traceback.format_exc()}")

    # Try importing app
    try:
        from app import app as real_app
        info["app_import"] = "ok"
    except Exception as e:
        info["app_import"] = f"FAIL: {e}"
        errors.append(f"app: {traceback.format_exc()}")

    info["errors"] = errors
    return jsonify(info)
