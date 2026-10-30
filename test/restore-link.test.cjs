const test=require('node:test');const assert=require('node:assert/strict');const {isRestoreLink}=require('../src/core/restore-link.cjs');
const {registerFreshRestoreLink}=require('../src/core/restore-link.cjs');
test('restore accepts only the fixed show URI without command arguments or private data',()=>{
 assert.equal(isRestoreLink('nova-fox-companion://show'),true);assert.equal(isRestoreLink('nova-fox-companion://show/'),true);
 for(const uri of ['https://example.test','nova-fox-companion://show?run=anything','nova-fox-companion://show/file','nova-fox-companion://hide','file:///test'])assert.equal(isRestoreLink(uri),false);
});
test('fresh normal launch registers the fixed link while existing profiles, handlers and previews stay unchanged',()=>{
 const calls=[];const app={isPackaged:false,getApplicationNameForProtocol:()=>'',setAsDefaultProtocolClient:(...args)=>{calls.push(args);return true;}};
 const options={app,isNewProfile:true,normalLaunch:true,executable:'C:/Nova/electron.exe',appPath:'C:/Nova/app'};
 for(const overrides of [{isNewProfile:false},{normalLaunch:false}])registerFreshRestoreLink({...options,...overrides});
 assert.equal(calls.length,0);
 app.getApplicationNameForProtocol=()=>'Existing Nova';registerFreshRestoreLink(options);assert.equal(calls.length,0);
 app.getApplicationNameForProtocol=()=>'';assert.equal(registerFreshRestoreLink(options).registered,true);
 assert.deepEqual(calls,[['nova-fox-companion','C:/Nova/electron.exe',['C:/Nova/app']]]);
 app.setAsDefaultProtocolClient=()=>{throw Error('Unavailable')};assert.equal(registerFreshRestoreLink(options).error,'Unavailable');
});
