'use strict';
const SCHEME = 'nova-fox-companion';
function registerFreshRestoreLink({ app, isNewProfile, normalLaunch, executable, appPath }) {
  if (!isNewProfile || !normalLaunch) return { registered: false, skipped: 'existing-profile-or-preview' };
  try {
    if (app.getApplicationNameForProtocol(`${SCHEME}://show`)) return { registered: false, skipped: 'existing-handler' };
    const args = app.isPackaged ? [] : [appPath];
    return { registered: app.setAsDefaultProtocolClient(SCHEME, executable, args) };
  } catch (error) { return { registered: false, error: error.message }; }
}
function isRestoreLink(value) {
  try {const url=new URL(value);return url.protocol===`${SCHEME}:`&&url.hostname==='show'&&(!url.pathname||url.pathname==='/')&&!url.search&&!url.hash&&!url.username&&!url.password&&!url.port;}
  catch{return false;}
}
module.exports={SCHEME,isRestoreLink,registerFreshRestoreLink};
