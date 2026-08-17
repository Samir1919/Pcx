// Shared test helpers for the PCX monorepo. Kept minimal and dependency-free so
// any app/package can import helpers without pulling in app-specific code.
export function given(overrides, defaults) {
  return { ...defaults, ...overrides };
}
