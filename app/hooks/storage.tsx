import { useState, useEffect } from "react";

type StorageType = "local" | "session";

export function useLocalStorage<T>(key: string, defaultValue: T, type: StorageType = "local") {
    const isBrowser = typeof window !== "undefined";
    const storage = isBrowser
        ? type === "local"
            ? localStorage
            : sessionStorage
        : null;

    const [state, setState] = useState<T>(() => {
        if (!isBrowser || !storage) return defaultValue;

        try {
            const stored = storage.getItem(key);
            return stored ? (JSON.parse(stored) as T) : defaultValue;
        }
        catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        if (!isBrowser || !storage) return;

        try {
            storage.setItem(key, JSON.stringify(state));
        } catch {
            // Handle storage errors (e.g., quota exceeded)
        }
    }, [key, state, storage]);

    return [state, setState] as const;
}
