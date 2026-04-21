package com.fangcun.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.WindowInsetsController
import android.webkit.*
import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
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
    private lateinit var splashView: LinearLayout
    private lateinit var statusText: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var poemIndex = 0
    private var poemAnimRunning = false
    private var serverReady = false
    private lateinit var splashPoem: String

    private val splashPoems = arrayOf(
        "可叹故人成白鸟，长追明月过天河",
        "暖春先我寻芳醉，寒夕因卿借酒耽",
        "亭前闲钓鸳鸯梦，阶上徐吹云月秋",
        "寂尔无言催布谷，等闲啼破数帘青",
        "想象琴声与栀子，曾同缱绻在黄昏",
        "两颗海珠萦渐渐，一倾昆玉系频频",
        "故国清风随信寄，他乡明月印章邮",
        "可怜谁爱清圆月，只有残时似我身",
        "如晦抽残珠后茧，作深凝定影中峦",
        "世路千寻春有际，浮生一苇梦偏长",
        "永夜片帆思渡海，一春双袂系行舟",
        "江左沈名蛩切切，淮扬绻梦夜辽辽",
        "飞来四下流英气，碎了中天肆剑芒",
        "三秋夜底星千落，两泪樽前雾一横",
        "海棠犹可随春发，灯影无从终夜看",
        "有约未成风自扫，多情难饲酒来浇",
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 根布局
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#FAF8F5"))

        // 启动画面 — Logo + 标题 + 诗句逐字动画
        splashView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(Color.parseColor("#FAF8F5"))
        }

        // Logo
        val logoView = ImageView(this).apply {
            setImageResource(R.drawable.splash_logo)
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        val logoDp = (120 * resources.displayMetrics.density).toInt()
        splashView.addView(logoView, LinearLayout.LayoutParams(logoDp, logoDp))

        // 汇文明朝体（子集）
        val poemFont = Typeface.createFromAsset(assets, "fonts/splash_poem.otf")

        // 随机选一句诗
        splashPoem = splashPoems.random()

        // 标题 "方寸"
        val titleView = TextView(this).apply {
            text = "方  寸"
            textSize = 24f
            setTextColor(Color.parseColor("#5C534A"))
            gravity = android.view.Gravity.CENTER
            letterSpacing = 0.3f
            typeface = poemFont
        }
        val titleParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = (20 * resources.displayMetrics.density).toInt() }
        splashView.addView(titleView, titleParams)

        // 诗句（逐字动画）
        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
            setTextColor(Color.parseColor("#999999"))
            gravity = android.view.Gravity.CENTER
            typeface = poemFont
        }
        val statusParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = (16 * resources.displayMetrics.density).toInt() }
        splashView.addView(statusText, statusParams)

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
                    serverReady = true
                    if (!poemAnimRunning) {
                        showWebView()
                    }
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
        // 立即开始诗句逐字动画
        startPoemAnimation()

        Thread {
            val baseDir = File(filesDir, "fangcun")

            // 提取 assets（按版本号判断是否需要重新提取）
            if (needsExtraction(baseDir)) {
                extractAssets("config", File(baseDir, "config"))
                extractAssets("frontend", File(baseDir, "frontend"))
                markExtracted(baseDir)
            }

            // 初始化 Chaquopy
            if (!Python.isStarted()) {
                Python.start(AndroidPlatform(this))
            }

            // 启动 Flask 服务器
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

    // ---- 诗句逐字动画 ----

    private fun startPoemAnimation() {
        poemIndex = 0
        poemAnimRunning = true
        statusText.text = ""
        typeNextChar()
    }

    private fun typeNextChar() {
        if (poemIndex >= splashPoem.length) {
            // 动画播完，停顿 0.5s 让用户看完整句
            handler.postDelayed({
                poemAnimRunning = false
                if (serverReady) showWebView()
            }, 500)
            return
        }
        val ch = splashPoem[poemIndex]
        statusText.append(ch.toString())
        poemIndex++
        val delay = if (ch == '，') 200L else 120L
        handler.postDelayed({ typeNextChar() }, delay)
    }

    private fun stopPoemAnimation() {
        poemAnimRunning = false
        handler.removeCallbacksAndMessages(null)
    }

    private fun showWebView() {
        splashView.visibility = View.GONE
        webView.visibility = View.VISIBLE
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

        @JavascriptInterface
        fun saveFile(content: String, fileName: String, mimeType: String) {
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/方寸")
                }
                val uri = contentResolver.insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
                )
                if (uri != null) {
                    contentResolver.openOutputStream(uri)?.use {
                        it.write(content.toByteArray(Charsets.UTF_8))
                    }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity,
                            "已保存到 下载/方寸/$fileName", Toast.LENGTH_SHORT).show()
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
