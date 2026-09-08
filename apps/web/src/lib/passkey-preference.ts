/** Remember last successful passkey so mobile can skip the account picker. */
const CRED_ID_KEY = "gymfolio.passkey.credentialId"
const TRANSPORTS_KEY = "gymfolio.passkey.transports"

export function getPreferredPasskey(): { credentialId: string; transports?: string[] } | null {
  try {
    const credentialId = localStorage.getItem(CRED_ID_KEY)
    if (!credentialId) return null
    const raw = localStorage.getItem(TRANSPORTS_KEY)
    let transports: string[] | undefined
    if (raw) {
      try {
        transports = JSON.parse(raw) as string[]
      } catch {
        transports = undefined
      }
    }
    return { credentialId, transports }
  } catch {
    return null
  }
}

export function rememberPasskey(credentialId: string, transports?: string[] | null) {
  try {
    localStorage.setItem(CRED_ID_KEY, credentialId)
    if (transports?.length) localStorage.setItem(TRANSPORTS_KEY, JSON.stringify(transports))
    else localStorage.removeItem(TRANSPORTS_KEY)
  } catch {
    /* private mode / quota */
  }
}

export function clearPreferredPasskey() {
  try {
    localStorage.removeItem(CRED_ID_KEY)
    localStorage.removeItem(TRANSPORTS_KEY)
  } catch {
    /* ignore */
  }
}
