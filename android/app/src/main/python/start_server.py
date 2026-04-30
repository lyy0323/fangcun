"""
Android 端 Flask 启动脚本

由 MainActivity.kt 通过 Chaquopy 调用 start(base_dir)。
- 设置配置目录环境变量
- 注入 api_keys 桩模块（Android 无需统计）
- 导入主 app 并添加前端静态文件服务
- 启动 Flask 本地服务器
"""

import os
import sys
import types
import ssl


def start(base_dir):
    """启动 Flask 服务器，base_dir 为提取后的资源根目录。"""

    config_dir = os.path.join(base_dir, "config")
    frontend_dir = os.path.join(base_dir, "frontend")

    # 1. 环境变量 —— 必须在 import app 之前设置
    os.environ["FANGCUN_CONFIG_DIR"] = config_dir

    # 2. 注入 api_keys 桩模块（Android 无需统计，避免 SQLite 依赖）
    stub = types.ModuleType("api_keys")
    stub.record_call = lambda source, route: None
    stub.get_route_stats = lambda date=None: []
    sys.modules["api_keys"] = stub

    # 3. 导入 Flask app（触发数据加载）
    from app import app

    # 4. 添加前端静态文件服务
    from flask import send_from_directory, request, Response
    import urllib.request

    # 覆盖 CSP：Android 端允许 data: URL（canvas 导出预览）和 blob:
    @app.after_request
    def relax_csp_for_android(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' data: blob:; "
            "connect-src 'self' https://write.sjtuguoxue.space https://checker.sjtuguoxue.space; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:"
        )
        return response

    # 代理外部诗词库 API（Android WebView 无法携带正确 Referer）
    _ssl_ctx = ssl.create_default_context()
    try:
        import certifi
        _ssl_ctx.load_verify_locations(certifi.where())
    except Exception:
        _ssl_ctx.check_hostname = False
        _ssl_ctx.verify_mode = ssl.CERT_NONE

    @app.route("/proxy/poems/<path:subpath>")
    def _proxy_poems(subpath):
        url = f"https://shi.sjtuguoxue.space/api/{subpath}"
        if request.query_string:
            url += f"?{request.query_string.decode()}"
        req = urllib.request.Request(url, headers={
            "Referer": "https://write.sjtuguoxue.space/",
        })
        try:
            with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as resp:
                data = resp.read()
                return Response(data, status=resp.status,
                                content_type=resp.headers.get("Content-Type", "application/json"))
        except Exception as e:
            return Response(str(e), status=502)

    @app.route("/")
    def _android_index():
        return send_from_directory(frontend_dir, "index.html")

    @app.route("/<path:path>")
    def _android_static(path):
        filepath = os.path.join(frontend_dir, path)
        if os.path.isfile(filepath):
            return send_from_directory(frontend_dir, path)
        return send_from_directory(frontend_dir, "index.html")

    # 5. 启动
    print(f"[Android] Flask 启动于 http://127.0.0.1:5050")
    app.run(host="127.0.0.1", port=5050, debug=False, use_reloader=False)
