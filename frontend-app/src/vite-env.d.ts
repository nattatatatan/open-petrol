/// <reference types="vite/client" />

// Raw SVG imports (Vite `?raw`) — design-system icons exported from Figma and
// inlined so they inherit `currentColor`. See src/components/Icon.tsx.
declare module "*.svg?raw" {
  const content: string;
  export default content;
}
