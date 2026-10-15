import { atomWithStorage } from "jotai/utils"

/** When false, WebMCP tools are unregistered even if the browser supports them. */
export const webMcpEnabledAtom = atomWithStorage("gymfolio:webmcp-enabled", true)
