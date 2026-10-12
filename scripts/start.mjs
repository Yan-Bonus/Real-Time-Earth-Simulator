import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.EARTH_DEV_URL
const child = spawn(electron, ['.'], { stdio: 'inherit', env })
child.once('exit', (code) => { process.exitCode = code ?? 0 })
child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
process.once('SIGINT', () => child.kill())
process.once('SIGTERM', () => child.kill())
