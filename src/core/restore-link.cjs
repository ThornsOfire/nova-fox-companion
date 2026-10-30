'use strict';
const SCHEME = 'nova-fox-companion';
function isRestoreLink(value) {
  try {const url=new URL(value);return url.protocol===`${SCHEME}:`&&url.hostname==='show'&&(!url.pathname||url.pathname==='/')&&!url.search&&!url.hash&&!url.username&&!url.password&&!url.port;}
  catch{return false;}
}
module.exports={SCHEME,isRestoreLink};
