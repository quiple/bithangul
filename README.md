# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --no-install .
```

## Developing

Install dependencies with Nub, then start a development server:

```sh
nub install
nub run dev

# or start the server and open the app in a new browser tab
nub run dev -- --open
```

The `prepare` script generates SvelteKit 3's `$app/tsconfig` and installs
Lefthook's Git hooks. `nub.jsonc` points Nub at `tsconfig.runtime.json`, which
has no generated dependencies. This allows Nub to start even before SvelteKit
has generated its configuration. To regenerate it and reinstall hooks, run:

```sh
nub run prepare
```

When updating an existing Husky checkout, remove its hooks path once before
installing Lefthook (only if `git config --get core.hooksPath` is `.husky/_`):

```sh
git config --unset core.hooksPath
nub --node run prepare
```

The pre-commit hook runs Oxlint and Oxfmt on staged files, then stages formatting
fixes.

## TypeScript

`nub run check` and `nub run check:watch` use svelte-check's `--tsgo` backend
with TypeScript **7.1.0-beta**, pinned as `@typescript/native`. TypeScript 6.0
remains installed for SvelteKit and svelte-check's JavaScript compiler API;
replacing it outright is not supported by this toolchain. The experimental
7.1 API backend is not enabled because it is incompatible with svelte-check
4.7.7. See the [svelte-check setup guide](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check).

The application's `tsconfig.json` still extends SvelteKit's generated config.
Its explicit `#lib/*` mapping mirrors `package.json` imports so the TS 7
checker can resolve generated Svelte component declarations. Nub's separate
runtime config is only for running tools, not for application type checking.

```sh
nub run check
nub run check:watch
nub run test
nub run lint
```

## Building

To create a production version of your app:

```sh
nub run build
```

You can preview the production build with `nub run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Font settings and export

The **폰트 설정** button beside Save edits the family/style names, version,
credits, copyright/license, grid dimensions (1–64 pixels), baseline, and Glyphs
UPM/pixel scale. These settings are included in project JSON. Older projects
keep their 16×16 grid and default baseline. Resizing anchors existing artwork at
the top left; shrinking requires acknowledging any filled pixels that would be
cropped.

- BDF preserves the grid dimensions and baseline.
- HEX pads the bottom to the next height in 16, 24, 32, 64, and pads the right
  edge to a whole byte (8 pixels), without changing the project. The filename
  includes the exported dimensions. HEX has no dimension header: extended
  sizes require a compatible reader and an explicit height, for example
  `hexdraw --height 24`. Tool-specific size limits vary; see the
  [GNU Unifont manual](https://unifoundry.com/unifont/doc/unifont.pdf).
- Glyphs exports a native Glyphs 3 project with reusable non-exporting `pixel`
  components, scaled metrics and font information, following the
  [Glyphs pixel-font workflow](https://glyphsapp.com/learn/pixelfont).

Run `nub run test` for bitmap, generation, settings round-trip, and export checks.

## UI components

The interface uses Astryx Svelte 0.5.2 with its Liquid Glass theme (preserving the application font family from before the Astryx migration). AppShell and Layout
provide the editor panels; Astryx supplies forms, dialogs, tabs, buttons and list
rows. SVG and canvas remain responsible for pixel artwork and virtual previews.

`app.css` imports Astryx's base, precompiled component CSS and theme, followed by
its Tailwind token bridge. The published package contains compiled StyleX classes,
so `astryx.css` is required in both development and production. The Astryx Vite
preset keeps package styles on the StyleX transform path; its HTML injection hook
is omitted because SvelteKit owns the HTML shell.

## Moving all glyphs

Use **편집 → 모든 글리프 이동** to move all component bitmaps one pixel up,
down, left or right. **Ctrl+Alt+Arrow** performs the same action (Control+Option
on macOS). Shortcuts are inactive in text inputs and dialogs. If any filled
pixel would leave the grid, the entire move is blocked and that menu action is
disabled. A move includes and commits the current editor draft; the baseline
and grid dimensions remain unchanged.
