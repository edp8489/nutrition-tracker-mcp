// Source - https://stackoverflow.com/a/70896134
// Posted by Caleb Denio
// Retrieved 2026-09-14, License - CC BY-SA 4.0

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
