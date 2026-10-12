import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import electron from 'electron'

// A private development server belongs to this Electron process and closes with it.
const server = await createServer({ server: { port: 5174, strictPort: true } })
await server.listen()
const env = { ...process.env, EARTH_DEV_URL: 'http://127.0.0.1:5174' }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.'], { stdio: 'inherit', env })
let closing = false
async function close(code = 0) {
  if (closing) return
  closing = true
  if (child.exitCode === null) child.kill()
  await server.close()
  process.exitCode = code
}
child.once('exit', (code) => void close(code ?? 0))
child.once('error', (error) => {
  console.error(error)
  void close(1)
})
process.once('SIGINT', () => void close())
process.once('SIGTERM', () => void close())
