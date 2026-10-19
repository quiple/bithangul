# AGENTS

Project-specific guidance for AI coding agents.

<!-- ASTRYX:START -->

Astryx v0.5.2 · 90+ components
CLI: run every command as `npx @astryx-svelte/cli <cmd>` (shown below as `astryx ...`).

SETUP (once) — without these, components render unstyled:
app.css: @import '@astryx-svelte/core/base.css';
@import '@astryx-svelte/theme-neutral/theme.css';
vite.config.ts: run @stylexjs/unplugin over @astryx-svelte/core (add it to optimizeDeps.exclude + ssr.noExternal).

WORKFLOW — discover, don't guess. Before writing UI:

1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:

- No <div> — components do all layout/spacing. Full page -> AppShell; sidebar nav -> SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status -> StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg). No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style=, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
search "<query>" find any component / util / doc / template / block
component --list 90+ components by category
template --list page + block recipes
docs <topic> browser-support, cli-integrations, color, elevation, getting-started, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, styling-libraries, theme, tokens, typography, working-with-ai
swizzle <Name> eject component source for deep customization
upgrade --apply run after any @astryx-svelte/core bump
<!-- ASTRYX:END -->
