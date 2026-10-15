package app.gymfolio.android

import android.os.Bundle
import android.webkit.WebView
import app.gymfolio.android.webmcp.WebMcpBridge
import app.gymfolio.android.webmcp.WebMcpJsInterface
import com.getcapacitor.BridgeActivity

/**
 * Capacitor host. Registers the JS ↔ AppFunctions bridge on the WebView.
 */
class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WebMcpBridge.attachActivity(this)
    bridge?.webView?.let { installBridge(it) }
  }

  override fun onResume() {
    super.onResume()
    bridge?.webView?.let { installBridge(it) }
  }

  override fun onDestroy() {
    WebMcpBridge.detachActivity(this)
    super.onDestroy()
  }

  private fun installBridge(webView: WebView) {
    WebMcpBridge.attachWebView(webView)
    webView.addJavascriptInterface(WebMcpJsInterface, WebMcpJsInterface.NAME)
  }
}
