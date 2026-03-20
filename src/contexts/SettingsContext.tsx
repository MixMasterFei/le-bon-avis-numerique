"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSession } from "next-auth/react"

interface Settings {
  blur18Plus: boolean
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>
  loading: boolean
}

const defaultSettings: Settings = {
  blur18Plus: true, // Default to blur enabled for safety
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => {},
  loading: true,
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  // Fetch settings on mount (for logged-in users)
  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.settings) {
            setSettings({
              blur18Plus: data.settings.blur18Plus ?? true,
            })
          }
        })
        .catch(() => {
          // Use defaults on error
        })
        .finally(() => setLoading(false))
    } else {
      // For non-logged-in users, check localStorage
      const stored = localStorage.getItem("blur18Plus")
      if (stored !== null) {
        queueMicrotask(() => setSettings({ blur18Plus: stored === "true" }))
      }
      queueMicrotask(() => setLoading(false))
    }
  }, [session])

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)

    if (session?.user) {
      // Save to database for logged-in users
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      })
    } else {
      // Save to localStorage for non-logged-in users
      if (newSettings.blur18Plus !== undefined) {
        localStorage.setItem("blur18Plus", String(newSettings.blur18Plus))
      }
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
