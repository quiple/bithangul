import {astryx} from '@astryx-svelte/core/vite'
import adapter from '@sveltejs/adapter-cloudflare'
import {sveltekit} from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import {defineConfig} from 'vite'

export default defineConfig({plugins: [astryx(), tailwindcss(), sveltekit({adapter: adapter()})]})
