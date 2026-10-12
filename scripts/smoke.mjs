// Desktop regressions now exercise online-only imagery. Dev mode keeps a local Vite renderer.
const mode=process.argv[2]
let server
try {
  if(mode==='dev'){
    const {createServer}=await import('vite');server=await createServer({server:{port:5175,strictPort:true}});await server.listen();process.env.EARTH_TEST_DEV_URL='http://127.0.0.1:5175'
  }
  process.argv=[process.argv[0],process.argv[1],'fixture',...(mode==='packaged'?[process.argv[3]]:[])]
  await import('./online-smoke.mjs')
}finally{await server?.close();delete process.env.EARTH_TEST_DEV_URL}
