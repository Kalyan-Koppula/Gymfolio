package app.gymfolio.android.webmcp

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.webkit.WebView
import app.gymfolio.android.MainActivity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Brings up the Capacitor WebView if needed, waits for WebMCP registration,
 * then invokes `gymfolioNativeInvoke` and returns the JSON result string.
 */
object WebMcpBridge {
  private const val READY_TIMEOUT_MS = 25_000L
  private const val INVOKE_TIMEOUT_MS = 30_000L

  private lateinit var appContext: Context
  private var activityRef: WeakReference<Activity>? = null
  private var webViewRef: WeakReference<WebView>? = null
  private val readyFlag = AtomicBoolean(false)
  private var readySignal = CompletableDeferred<Unit>()

  fun init(context: Context) {
    appContext = context.applicationContext
  }

  fun attachActivity(activity: Activity) {
    activityRef = WeakReference(activity)
  }

  fun detachActivity(activity: Activity) {
    if (activityRef?.get() === activity) {
      activityRef = null
    }
  }

  fun attachWebView(webView: WebView) {
    webViewRef = WeakReference(webView)
  }

  fun markReady() {
    readyFlag.set(true)
    if (!readySignal.isCompleted) {
      readySignal.complete(Unit)
    }
  }

  fun resetReady() {
    readyFlag.set(false)
    readySignal = CompletableDeferred()
  }

  suspend fun invokeTool(name: String, argsJson: String = "{}"): String {
    ensureUi()
    awaitReady()
    val id = UUID.randomUUID().toString()
    val deferred = WebMcpJsInterface.register(id)
    val nameLit = JSONObject.quote(name)
    val argsLit = JSONObject.quote(argsJson)
    val idLit = JSONObject.quote(id)
    val script =
      """
      (function(){
        var invoke = window.gymfolioNativeInvoke;
        if (typeof invoke !== 'function') {
          GymfolioNative.onError($idLit, 'gymfolioNativeInvoke missing — open app and sign in');
          return;
        }
        Promise.resolve(invoke($nameLit, $argsLit)).then(function(r) {
          GymfolioNative.onResult($idLit, typeof r === 'string' ? r : JSON.stringify(r));
        }).catch(function(e) {
          GymfolioNative.onError($idLit, String(e && e.message ? e.message : e));
        });
      })();
      """.trimIndent()

    withContext(Dispatchers.Main) {
      val webView = webViewRef?.get()
      if (webView == null) {
        deferred.complete(
          """{"ok":false,"error":"not_ready","message":"WebView unavailable — open Gymfolio"}""",
        )
        return@withContext
      }
      webView.evaluateJavascript(script, null)
    }

    return try {
      withTimeout(INVOKE_TIMEOUT_MS) { deferred.await() }
    } catch (e: Exception) {
      WebMcpJsInterface.cancel(id)
      """{"ok":false,"error":"timeout","message":${JSONObject.quote(e.message ?: "invoke timed out")}}"""
    }
  }

  private suspend fun ensureUi() {
    if (webViewRef?.get() != null && activityRef?.get() != null) return
    withContext(Dispatchers.Main) {
      val intent =
        Intent(appContext, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
      appContext.startActivity(intent)
    }
    // Brief yield for Activity + WebView attach
    var spins = 0
    while (webViewRef?.get() == null && spins < 50) {
      delay(100)
      spins++
    }
  }

  private suspend fun awaitReady() {
    if (readyFlag.get()) return
    // Nudge page in case register already happened before interface attach
    withContext(Dispatchers.Main) {
      webViewRef?.get()?.evaluateJavascript(
        """
        (function(){
          if (window.__GYMFOLIO_WEBMCP__ && window.__GYMFOLIO_WEBMCP__.enabled) {
            try { GymfolioNative.onReady(); } catch (e) {}
          }
        })();
        """.trimIndent(),
        null,
      )
    }
    try {
      withTimeout(READY_TIMEOUT_MS) { readySignal.await() }
    } catch (_: Exception) {
      throw IllegalStateException(
        "WebMCP not ready — open Gymfolio, sign in, enable Settings → AI agents",
      )
    }
  }
}
