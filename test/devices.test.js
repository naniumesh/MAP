const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nearme-test-'));
process.env.NEARME_DATA_DIR=dir;
const store=require('../lib/store');
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('repeat device replaces old coordinates; separate device stays; late older update cannot overwrite latest',async()=>{
 await store.add({id:'1',visitorId:'device-a',lat:12,lng:77,time:'2026-10-14T10:00:00Z'});
 await store.add({id:'2',visitorId:'device-b',lat:13,lng:78,time:'2026-10-14T10:01:00Z'});
 await store.add({id:'3',visitorId:'device-a',lat:14,lng:79,time:'2026-10-14T11:00:00Z'});
 await store.add({id:'4',visitorId:'device-a',lat:11,lng:76,time:'2026-10-14T09:00:00Z'});
 const rows=await store.all();assert.equal(rows.length,2);assert.equal(rows[0].lat,14);assert.equal(rows[0].visitorId,'device-a');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'visits.json'))).length,2);
});
test('legacy duplicate records collapse to latest without merging distinct device IDs',()=>{
 const rows=store.latestPerDevice([{visitorId:'a',time:'2026-10-14T10:00:00Z'},{visitorId:'b',time:'2026-10-14T11:00:00Z'},{visitorId:'a',time:'2026-10-14T12:00:00Z'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].time,'2026-10-14T12:00:00Z');
});
test('directions link targets recorded coordinates and device ID persists only on consented send',()=>{
 const admin=fs.readFileSync(path.join(__dirname,'../public/admin.html'),'utf8');
 assert.ok(admin.includes('https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}'));
 const page=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(page,/localStorage.getItem\('nearme_vid'\)/);assert.match(page,/visitorId: deviceId\(\)/);assert.match(page,/if \(\$\("#saveVisit"\).checked\) fetch/);
});
