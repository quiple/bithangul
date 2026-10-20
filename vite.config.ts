import {astryx} from '@astryx-svelte/core/vite'
import adapter from '@sveltejs/adapter-cloudflare'
import {sveltekit} from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import {defineConfig, type Plugin} from 'vite'

// SvelteKit owns the HTML shell; published Astryx components use astryx.css.
// Keep the StyleX transform for any uncompiled package styles.
const astryxPlugins = (astryx({include: ['@astryx-svelte/theme-liquid-glass']}) as Plugin[]).map((plugin) => {
  const {transformIndexHtml: _html, ...svelteKitPlugin} = plugin
  return svelteKitPlugin
})

export default defineConfig({
  plugins: [astryxPlugins, tailwindcss(), sveltekit({adapter: adapter()})],
})
