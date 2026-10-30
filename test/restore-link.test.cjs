const test=require('node:test');const assert=require('node:assert/strict');const {isRestoreLink}=require('../src/core/restore-link.cjs');
test('restore accepts only the fixed show URI without command arguments or private data',()=>{
 assert.equal(isRestoreLink('nova-fox-companion://show'),true);assert.equal(isRestoreLink('nova-fox-companion://show/'),true);
 for(const uri of ['https://example.test','nova-fox-companion://show?run=anything','nova-fox-companion://show/file','nova-fox-companion://hide','file:///test'])assert.equal(isRestoreLink(uri),false);
});
