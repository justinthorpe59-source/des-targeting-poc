/**
 * Whether the splash has already been shown in this browsing session.
 *
 * Lives here rather than in App.tsx because two places need it and App is one
 * of them: App reads and sets it, and the shell's Searchlight wordmark clears
 * it to send the user back to the splash. Importing from App.tsx would be a
 * cycle, since App renders the shell.
 *
 * sessionStorage is the boundary we want: it survives a refresh and internal
 * navigation in the same tab, and starts empty in a new tab or window.
 *
 * Every access is wrapped because a browser with site data blocked throws on
 * it, and the splash is not worth a blank application over. If it throws, the
 * splash simply shows on each load.
 */
const SPLASH_KEY = 'searchlight:splash-seen'

export function splashAlreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_KEY) === 'true'
  } catch {
    return false
  }
}

export function rememberSplashSeen(): void {
  try {
    window.sessionStorage.setItem(SPLASH_KEY, 'true')
  } catch {
    /* Ignored — see above. */
  }
}

export function forgetSplashSeen(): void {
  try {
    window.sessionStorage.removeItem(SPLASH_KEY)
  } catch {
    /* Ignored — see above. */
  }
}
