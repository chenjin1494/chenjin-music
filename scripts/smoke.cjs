const { _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')
async function main() {
 const output=path.resolve('artifacts');await fs.mkdir(output,{recursive:true})
 const errors=[]
 const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE
 const app=await electron.launch({args:[path.resolve('.')],env:environment,timeout:30000})
 try {
  const win=await app.firstWindow();win.on('pageerror',error=>errors.push(error.message));await win.waitForLoadState('domcontentloaded');await win.locator('body').waitFor();await win.waitForTimeout(1600)
  await win.screenshot({path:path.join(output,'chenjin-dark.png'),fullPage:true})
  const text=await win.locator('body').innerText()
  const info=await win.evaluate(()=>window.chenjin.invoke('app.info'))
  await fs.writeFile(path.join(output,'smoke-report.json'),JSON.stringify({info,title:await win.title(),text:text.slice(0,5000),errors},null,2))
  console.log(JSON.stringify({info,errors,text:text.slice(0,1000)},null,2))
  if(errors.length)throw new Error(errors.join('\n'))
 } finally {await app.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
