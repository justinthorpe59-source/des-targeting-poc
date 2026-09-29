# Vendored React Bits components

Fetched from the React Bits registry and committed as plain files, not
installed through a CLI.

This project has no shadcn setup, and the one component needed here did not
justify introducing that toolchain. `TechText` is vendored instead:

    curl -sL https://reactbits.dev/r/TechText-JS-CSS.json

Source: https://reactbits.dev/text-animations/tech-text
Fetched: 29 Sept 2026. Variant: JS + CSS.

**Dependencies: none.** The registry entry lists an empty `dependencies` and
`registryDependencies` array, and the component is plain canvas 2D — no
shader, WebGL or animation library is involved, so nothing was installed and
no functionality was skipped to avoid a dependency.

Unmodified from the registry, so it can be re-fetched and diffed. It is typed
for the rest of the app by the adjacent `TechText.d.ts`, which is ours, not
theirs — that file exists so the app's `.tsx` can import a `.jsx` without
turning on `allowJs` for the whole project.
