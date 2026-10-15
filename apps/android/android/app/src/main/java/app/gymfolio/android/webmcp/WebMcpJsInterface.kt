package app.gymfolio.android.webmcp

import android.webkit.JavascriptInterface
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap

/**
 * Receives async results from page JS (evaluateJavascript cannot await Promises).
 */
object WebMcpJsInterface {
  const val NAME = "GymfolioNative"

  private val pending = ConcurrentHashMap<String, CompletableDeferred<String>>()

  fun register(id: String): CompletableDeferred<String> {
    val deferred = CompletableDeferred<String>()
    pending[id] = deferred
    return deferred
  }

  fun cancel(id: String) {
    pending.remove(id)?.cancel()
  }

  @JavascriptInterface
  fun onReady() {
    WebMcpBridge.markReady()
  }

  @JavascriptInterface
  fun onResult(id: String, json: String) {
    pending.remove(id)?.complete(json)
  }

  @JavascriptInterface
  fun onError(id: String, message: String) {
    pending.remove(id)?.complete(
      """{"ok":false,"error":"unknown","message":${org.json.JSONObject.quote(message)}}""",
    )
  }
}
