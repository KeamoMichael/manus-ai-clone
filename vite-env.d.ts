/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly DEV: boolean
    // Add other env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
