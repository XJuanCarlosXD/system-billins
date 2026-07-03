/* Regenera src/routeTree.gen.ts con la misma config que usa el plugin de vite. */
const { Generator, getConfig } = require('@tanstack/router-generator')
const path = require('path')

async function main() {
  const root = __dirname
  const config = await getConfig(
    { target: 'react', autoCodeSplitting: true },
    root,
  )
  const gen = new Generator({ config, root })
  await gen.run()
  console.log('routeTree regenerado OK')
}

main().catch((e) => { console.error(e); process.exit(1) })
