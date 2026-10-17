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
Lefthook's Git hooks. It runs SvelteKit sync with Nub's `--node` option so it
can generate the TypeScript configuration before Nub tries to read it.
If the generated configuration is missing, restore it with:

```sh
nub --node run prepare
```

When updating an existing Husky checkout, remove its hooks path once before
installing Lefthook (only if `git config --get core.hooksPath` is `.husky/_`):

```sh
git config --unset core.hooksPath
nub --node run prepare
```

The pre-commit hook runs Oxlint and Oxfmt on staged files, then stages formatting
fixes. Lefthook is pinned to 2.0.11 because newer releases failed Nub's publisher
trust check. TypeScript stays on 6.x for compatibility with SvelteKit and
`svelte-check`.

## Building

To create a production version of your app:

```sh
nub run build
```

You can preview the production build with `nub run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
