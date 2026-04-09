package com.fangcun.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.WindowInsetsController
import android.webkit.*
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var splashView: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 根布局
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#FAF8F5"))

        // 启动画面 (加载中)
        splashView = TextView(this).apply {
            text = "方寸 · 诗词创作画布\n\n加载中…"
            textSize = 18f
            setTextColor(Color.parseColor("#5C534A"))
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(Color.parseColor("#FAF8F5"))
        }
        root.addView(splashView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        // WebView (初始隐藏)
        webView = WebView(this).apply {
            visibility = View.GONE
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                // 在 UserAgent 中标记 Android 端，前端可同步检测
                userAgentString = "$userAgentString FangcunAndroid"
            }
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    // 页面加载完成，注入 Android 标记，切换到 WebView
                    view?.evaluateJavascript(
                        "window.__FANGCUN_ANDROID__ = true;", null
                    )
                    splashView.visibility = View.GONE
                    visibility = View.VISIBLE
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?, request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    // 只允许本地 Flask 服务的请求
                    if (url.startsWith("http://127.0.0.1:5050")) return false
                    // 外部链接用系统浏览器打开
                    startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url))
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                // 拦截 window.open()
                override fun onCreateWindow(
                    view: WebView?, isDialog: Boolean,
                    isUserGesture: Boolean, resultMsg: android.os.Message?
                ): Boolean = false
            }

            // 添加 JS 桥接（图片保存）
            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        }
        root.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(root)

        // 沉浸式状态栏（必须在 setContentView 之后）
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            )
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        // 后台线程：提取资源 + 启动 Flask + 等待就绪 + 加载页面
        Thread {
            val baseDir = File(filesDir, "fangcun")

            // 提取 assets（按版本号判断是否需要重新提取）
            if (needsExtraction(baseDir)) {
                runOnUiThread { splashView.text = "方寸 · 诗词创作画布\n\n首次启动，正在准备数据…" }
                extractAssets("config", File(baseDir, "config"))
                extractAssets("frontend", File(baseDir, "frontend"))
                markExtracted(baseDir)
            }

            // 初始化 Chaquopy
            if (!Python.isStarted()) {
                Python.start(AndroidPlatform(this))
            }

            // 启动 Flask 服务器
            runOnUiThread { splashView.text = "方寸 · 诗词创作画布\n\n启动服务…" }
            Thread {
                val py = Python.getInstance()
                val mod = py.getModule("start_server")
                mod.callAttr("start", baseDir.absolutePath)
            }.start()

            // 轮询等待服务就绪
            waitForServer()

            // 加载页面
            runOnUiThread {
                webView.loadUrl("http://127.0.0.1:5050")
            }
        }.start()
    }

    // ---- JS 桥接：保存图片到相册/下载 ----

    inner class AndroidBridge {
        @JavascriptInterface
        fun saveImage(base64Data: String, fileName: String) {
            try {
                val data = Base64.decode(base64Data, Base64.DEFAULT)
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/方寸")
                }
                val uri = contentResolver.insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values
                )
                if (uri != null) {
                    contentResolver.openOutputStream(uri)?.use { it.write(data) }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity,
                            "已保存到 图片/方寸/$fileName", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity,
                        "保存失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ---- 版本检查 ----

    private fun currentVersion(): String =
        try { packageManager.getPackageInfo(packageName, 0).versionName ?: "0" }
        catch (_: Exception) { "0" }

    private fun needsExtraction(baseDir: File): Boolean {
        val versionFile = File(baseDir, ".version")
        return !versionFile.exists() || versionFile.readText().trim() != currentVersion()
    }

    private fun markExtracted(baseDir: File) {
        File(baseDir, ".version").writeText(currentVersion())
    }

    // ---- 资源提取 ----

    private fun extractAssets(assetPath: String, targetDir: File) {
        if (targetDir.exists()) targetDir.deleteRecursively()
        targetDir.mkdirs()

        val files = assets.list(assetPath) ?: return
        for (file in files) {
            val srcPath = "$assetPath/$file"
            val targetFile = File(targetDir, file)
            val subFiles = assets.list(srcPath)
            if (subFiles != null && subFiles.isNotEmpty()) {
                extractAssets(srcPath, targetFile)
            } else {
                assets.open(srcPath).use { input ->
                    FileOutputStream(targetFile).use { output ->
                        input.copyTo(output)
                    }
                }
            }
        }
    }

    // ---- 等待 Flask 就绪 ----

    private fun waitForServer() {
        for (i in 1..60) {
            try {
                val conn = URL("http://127.0.0.1:5050/api/rhyme/list?book=Pingshuiyun")
                    .openConnection() as HttpURLConnection
                conn.connectTimeout = 500
                conn.readTimeout = 500
                if (conn.responseCode == 200) return
            } catch (_: Exception) { }
            Thread.sleep(500)
        }
    }

    // ---- 返回键 ----

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
