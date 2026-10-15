package app.gymfolio.android.appfunctions

import androidx.annotation.RequiresApi
import androidx.appfunctions.AppFunctionDeclaration
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint
import app.gymfolio.android.webmcp.WebMcpBridge
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * OS-level agent entrypoints. Each call is forwarded into the in-WebView WebMCP registry
 * (same tools as desktop `window.__GYMFOLIO_WEBMCP__`).
 *
 * KSP generates concrete `GymfolioAppFunctionService` from [serviceName].
 * Requires Android 16+ (API 36). Gemini discovery may be EAP-gated; use
 * `adb shell cmd app_function` for local verification.
 */
@RequiresApi(36)
@AppFunctionServiceEntryPoint(
  serviceName = "GymfolioAppFunctionService",
  appFunctionXmlFileName = "gymfolio_app_functions",
)
abstract class BaseGymfolioAppFunctionService : AppFunctionService() {

  /**
   * Invoke any Gymfolio WebMCP tool by name.
   * @param name Tool id, e.g. get_today_overview or log_hydration.
   * @param argsJson JSON object string of tool arguments; use {} when none.
   * @return JSON string from the WebMCP handler ({ ok, data } or { ok:false, error }).
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun invokeWebMcpTool(name: String, argsJson: String): String =
    withContext(Dispatchers.IO) {
      WebMcpBridge.invokeTool(name, argsJson.ifBlank { "{}" })
    }

  /**
   * Signed-in user and onboarding state.
   * @return JSON session payload.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun getSession(): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("get_session") }

  /**
   * Today's training / recovery overview for the signed-in member.
   * @return JSON overview payload.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun getTodayOverview(): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("get_today_overview") }

  /**
   * Log water intake.
   * @param amountMl Volume in milliliters.
   * @return JSON result of log_hydration.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun logHydration(amountMl: Int): String =
    withContext(Dispatchers.IO) {
      WebMcpBridge.invokeTool("log_hydration", """{"amountMl":$amountMl}""")
    }

  /**
   * Today's hydration totals.
   * @return JSON hydration payload.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun getHydration(): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("get_hydration") }

  /**
   * In-progress workout, if any.
   * @return JSON workout payload.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun getInProgressWorkout(): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("get_in_progress_workout") }

  /**
   * Log a set on the active workout.
   * @param argsJson JSON for log_set (exerciseId, reps, weight, etc.).
   * @return JSON result.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun logSet(argsJson: String): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("log_set", argsJson) }

  /**
   * Start today's planned workout (or the given routine).
   * @param argsJson JSON (e.g. routineId); use {} for default.
   * @return JSON result of start_workout.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun startWorkout(argsJson: String): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("start_workout", argsJson.ifBlank { "{}" }) }

  /**
   * Finish the in-progress workout.
   * @return JSON result of finish_workout.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun finishWorkout(): String =
    withContext(Dispatchers.IO) { WebMcpBridge.invokeTool("finish_workout") }
}
