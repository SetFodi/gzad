import { useCallback, useSyncExternalStore } from "react"

export function useMediaQuery(query: string) {
    const subscribe = useCallback((onStoreChange: () => void) => {
        const result = matchMedia(query)
        result.addEventListener("change", onStoreChange)
        return () => result.removeEventListener("change", onStoreChange)
    }, [query])

    const getSnapshot = useCallback(() => matchMedia(query).matches, [query])

    // No viewport on the server — render the base case and let hydration correct it.
    const getServerSnapshot = useCallback(() => false, [])

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
