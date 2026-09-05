/**
 * Shared content width for the app chrome (shell, tabs, resume bar, sticky actions).
 * Below tablet (md) this matches the original phone column (max-w-2xl).
 * From tablet up the frame opens so desktop isn't stuck in a thin strip.
 */
export const APP_FRAME = "mx-auto w-full max-w-2xl md:max-w-[min(100%,80rem)]"
