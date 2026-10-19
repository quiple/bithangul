import {existsSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {fileURLToPath} from 'node:url'

// Match Vite's TypeScript resolution for the framework-independent pipeline tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidate
    if (specifier.startsWith('#lib/')) candidate = new URL(`../src/lib/${specifier.slice(5)}`, import.meta.url)
    else if (specifier.startsWith('.') && context.parentURL) candidate = new URL(specifier, context.parentURL)
    if (candidate?.protocol === 'file:') {
      const path = fileURLToPath(candidate)
      const source = path.endsWith('.js') ? path.slice(0, -3) + '.ts' : path + '.ts'
      if (existsSync(source)) return nextResolve(new URL(source, 'file:').href, context)
    }
    return nextResolve(specifier, context)
  },
})
