/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}