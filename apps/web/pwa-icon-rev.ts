/**
 * Bump this whenever favicon / PWA / apple-touch icons change.
 * Query strings on icon URLs give Chromium a new resource identity so the
 * installed app is more likely to refresh the launcher icon. Android/iOS
 * home-screen icons can still lag; uninstall/reinstall remains the reliable fix.
 */
export const PWA_ICON_REV = "20260906-dumbbell"
