const {_electron:electron}=require('@playwright/test')
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
async function main(){
 const root=path.resolve('.'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'chenjin-search-ui-')),baseline=process.argv.includes('--baseline'),packaged=process.argv.includes('--packaged'),report={baseline,packaged,checks:[],errors:[],screenshots:[]};let app
 const check=(name,passed,evidence)=>report.checks.push({name,passed,evidence})
 try{
  const env={...process.env,CHENJIN_TEST_USER_DATA:path.join(temp,'data'),PORTABLE_EXECUTABLE_DIR:temp};delete env.ELECTRON_RUN_AS_NODE
  app=await electron.launch(packaged?{executablePath:path.join(root,'release/win-unpacked/琛瑾音乐.exe'),env,timeout:45000}:{args:[root],env,timeout:45000});const page=await app.firstWindow()
  await app.evaluate(({ipcMain})=>{const original=ipcMain._invokeHandlers.get('chenjin:invoke');if(!original)throw new Error('Missing real application IPC handler');ipcMain.removeHandler('chenjin:invoke');ipcMain.handle('chenjin:invoke',async(event,method,params)=>{if(method==='search.hot')return ['热门词','verylongkeyword'.repeat(18)];if(method==='search.suggest'){await new Promise(resolve=>setTimeout(resolve,params.keyword==='延迟'?600:20));return [params.keyword+'建议','LongUnbrokenSuggestion'.repeat(18)]}if(method==='search.music')return {list:[],total:0,page:1,limit:30};return original(event,method,params)})})
  await page.waitForFunction(()=>document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('music')?.hydrated)
  const info=await page.evaluate(()=>window.chenjin.invoke('app.info'));assert.equal(info.version,'0.1.0');assert.equal(path.resolve(info.userData),path.resolve(temp,'data'));report.version=info.version
  const input=page.locator('.search-input'),popup=page.locator('.search-popover'),content=page.locator('.home-heading h1');const open=async()=>{await input.click();await popup.waitFor()}
  await page.evaluate(()=>{const store=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('music');store.library.searchHistory=['历史选择测试','LongUnbrokenHistory'.repeat(18)]})
  await open();await content.click();check('Clicking non-focusable page text closes suggestions',await popup.count()===0)
  if(await popup.count())await page.locator('[aria-label="关闭搜索建议"]').click()
  await open();await page.locator('.nav-item').filter({hasText:'音源管理'}).click();check('Navigation closes suggestions',await popup.count()===0)
  if(await popup.count())await page.locator('[aria-label="关闭搜索建议"]').click()
  await page.locator('.brand').click();await open();await page.locator('.suggestion').filter({hasText:'历史选择测试'}).click();check('Selecting a history item still searches and closes the panel',await popup.count()===0&&await input.inputValue()==='历史选择测试'&&await page.locator('.main-content').getAttribute('data-page')==='search')
  await page.locator('.brand').click();await input.fill('');await open();await page.locator('.search-popover .section-title button').filter({hasText:'清空'}).click();check('Clicks inside the panel keep it open',await popup.count()===1)
  await page.keyboard.press('Escape');check('Escape closes the panel while its button is focused',await popup.count()===0)
  if(await popup.count())await page.locator('[aria-label="关闭搜索建议"]').click()
  await open();await page.locator('.theme-toggle').focus();check('Keyboard focus leaving search closes suggestions',await popup.count()===0)
  if(await popup.count())await page.locator('[aria-label="关闭搜索建议"]').click()
  await open();await page.keyboard.press('Escape');await input.click();check('Clicking an already focused input reopens suggestions after Escape',await popup.count()===1);await page.keyboard.press('Escape')
  await open();await input.fill('延迟');await page.waitForTimeout(300);await page.locator('.brand').click();await page.waitForTimeout(700);check('Late suggestion responses do not reopen the panel',await popup.count()===0)
  if(await popup.count())await page.locator('[aria-label="关闭搜索建议"]').click()
  await input.fill('长文字');await open();await page.locator('.suggestion').first().waitFor()
  for(const [width,height] of [[1280,860],[960,720],[720,600]]){
   await app.evaluate(({BrowserWindow},{width,height})=>{const win=BrowserWindow.getAllWindows().find(win=>win.isVisible());win.setMinimumSize(480,480);win.setContentSize(width,height)},{width,height});await page.waitForTimeout(100)
   const metrics=await popup.evaluate(node=>{const bounds=node.getBoundingClientRect(),input=document.querySelector('.search-input').getBoundingClientRect();return {width:bounds.width,left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,screenWidth:innerWidth,screenHeight:innerHeight,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,inputBottom:input.bottom,rows:[...node.querySelectorAll('.suggestion')].map(item=>({scrollWidth:item.scrollWidth,clientWidth:item.clientWidth,height:item.getBoundingClientRect().height}))}})
   check(`Search panel fits ${width}x${height} and long text stays inside rows`,metrics.left>=0&&metrics.right<=metrics.screenWidth+1&&metrics.bottom<=metrics.screenHeight+1&&metrics.top>=metrics.inputBottom&&metrics.scrollWidth<=metrics.clientWidth+1&&metrics.rows.every(row=>row.scrollWidth<=row.clientWidth+1),metrics)
   if(width===960){const image=path.join(root,'artifacts',baseline?'search-ui-before.png':packaged?'search-ui-packaged.png':'search-ui-after.png');await page.screenshot({path:image});report.screenshots.push(image)}
  }
  await input.fill('');await open();const historyMetrics=await popup.evaluate(node=>{const bounds=node.getBoundingClientRect(),player=document.querySelector('.player-bar')?.getBoundingClientRect();return {bottom:bounds.bottom,playerTop:player?.top,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,chipRows:[...node.querySelectorAll('.chips button')].map(item=>({scrollWidth:item.scrollWidth,clientWidth:item.clientWidth}))}});check('Long hot keywords fit and the panel stays above the player',historyMetrics.scrollWidth<=historyMetrics.clientWidth+1&&historyMetrics.chipRows.every(row=>row.scrollWidth<=row.clientWidth+1)&&historyMetrics.bottom<=(historyMetrics.playerTop??600),historyMetrics)
  report.passed=report.checks.every(check=>check.passed)
 }catch(e){report.errors.push(e.stack);report.passed=false}finally{
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',baseline?'search-ui-before-report.json':packaged?'search-ui-packaged-report.json':'search-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(app)await app.close();assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('chenjin-search-ui-'));await fs.rm(temp,{recursive:true,force:true})
 }
 if(!baseline&&!report.passed)process.exitCode=1
}
main().catch(e=>{console.error(e);process.exitCode=1})
