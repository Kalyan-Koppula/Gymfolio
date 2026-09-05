import { AiDegradedError } from "./types.ts"

const DEFAULT_TIMEOUT_MS = 45_000

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user"
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >
    }

export type ToolDefinition = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string }
      }>
      content?: string | null
    }
  }>
  error?: { message?: string }
}

export type CompatClientOptions = {
  baseUrl: string
  apiKey: string
  model: string
  /** Extra headers (e.g. OpenRouter HTTP-Referer). */
  headers?: Record<string, string>
  timeoutMs?: number
}

/**
 * OpenAI-compatible chat completions with forced tool/function calling.
 * Parses the first matching tool-call arguments as JSON.
 */
export async function chatWithForcedTool<T>(
  opts: CompatClientOptions,
  args: {
    messages: ChatMessage[]
    tool: ToolDefinition
    parse: (toolArgs: unknown) => T
  },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        ...opts.headers,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: args.messages,
        tools: [args.tool],
        tool_choice: { type: "function", function: { name: args.tool.function.name } },
      }),
    })

    if (res.status === 401) {
      throw new AiDegradedError("AI provider rejected the API key (401)")
    }
    if (res.status === 429) {
      throw new AiDegradedError("AI provider rate-limited the request (429)")
    }
    if (!res.ok) {
      throw new AiDegradedError(`AI provider error (${res.status})`)
    }

    const data = (await res.json()) as ChatCompletionResponse
    if (data.error?.message) {
      throw new AiDegradedError(data.error.message)
    }

    const toolCalls = data.choices?.[0]?.message?.tool_calls ?? []
    const match =
      toolCalls.find((t) => t.function?.name === args.tool.function.name) ?? toolCalls[0]
    const rawArgs = match?.function?.arguments
    if (!rawArgs) {
      throw new AiDegradedError("AI response missing required tool call")
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawArgs)
    } catch {
      throw new AiDegradedError("AI tool-call arguments were not valid JSON")
    }

    return args.parse(parsed)
  } catch (err) {
    if (err instanceof AiDegradedError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiDegradedError("AI provider timed out")
    }
    throw new AiDegradedError(err instanceof Error ? err.message : "AI provider call failed")
  } finally {
    clearTimeout(timer)
  }
}

/** Run once; on schema/parse failure, retry once (architecture §7). */
export async function withSchemaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!(err instanceof AiDegradedError)) throw err
    // Retry only validation / malformed-tool failures, not auth/quota/timeout.
    const retryable =
      err.reason.includes("schema") ||
      err.reason.includes("tool call") ||
      err.reason.includes("valid JSON") ||
      err.reason.includes("no valid exercise")
    if (!retryable) throw err
    return await fn()
  }
}
