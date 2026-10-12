// Exercise the actual disclosure/settings controls; keep desktop regressions compatible.
export async function prepareControls(page,settings=false) {
 const expand=page.getByRole('button',{name:'展开面板',exact:true});if(await expand.isVisible())await expand.click()
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor()
 for(const group of await page.locator('.control-group').all())if(!await group.evaluate(n=>n.open))await group.locator('summary').click()
 const button=page.getByRole('button',{name:'设置',exact:true})
 if(settings&&await button.count()&&!await page.locator('#viewer-settings').count())await button.click()
}
export async function collapseControls(page) {
 for(const group of await page.locator('.control-group').all())if(await group.evaluate(n=>n.open))await group.locator('summary').click()
 if(await page.getByRole('button',{name:'关闭设置',exact:true}).count())await page.getByRole('button',{name:'关闭设置',exact:true}).click()
}
export async function setSimulationRate(page,input) {
 const rate=Number(input),direction=page.getByRole('combobox',{name:'时间方向',exact:true})
 if(!await direction.count()){await page.getByRole('combobox',{name:'模拟速度',exact:true}).selectOption(String(rate));return}
 const current=Number(await page.getByTestId('time-controls').getAttribute('data-rate'))
 if(rate===0){if(current!==0)await page.getByRole('button',{name:'暂停时间',exact:true}).click();return}
 await direction.selectOption(rate<0?'reverse':'forward')
 await page.getByRole('combobox',{name:'模拟速度',exact:true}).selectOption(String(Math.abs(rate)))
 if(current===0)await page.getByRole('button',{name:'继续播放',exact:true}).click()
}
