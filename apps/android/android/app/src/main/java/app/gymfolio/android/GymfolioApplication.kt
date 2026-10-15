package app.gymfolio.android

import android.app.Application
import app.gymfolio.android.webmcp.WebMcpBridge

class GymfolioApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    WebMcpBridge.init(this)
  }
}
