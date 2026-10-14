const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const places=require('../api/places');
const crowd=require('../api/crowd');
const store=require('../lib/store');
function response(){return {code:200,headers:{},status(c){this.code=c;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;return this;}};}
test('Google ratings, schedule and zero latitude survive mapping',async()=>{
 const old=global.fetch;process.env.GOOGLE_API_KEY='test';
 global.fetch=async(url,opts)=>{assert.match(url,/places:searchNearby/);assert.match(opts.headers['X-Goog-FieldMask'],/currentOpeningHours/);return {ok:true,json:async()=>({places:[{id:'abc',displayName:{text:'Cafe'},location:{latitude:0,longitude:77},rating:4.5,userRatingCount:12,currentOpeningHours:{openNow:false,weekdayDescriptions:['Monday: Closed']}}]})};};
 try{const r=response();await places({query:{cat:'food',lat:'0',lng:'77'}},r);assert.equal(r.code,200);assert.equal(r.body.places[0].rating,4.5);assert.equal(r.body.places[0].openNow,false);assert.equal(r.body.places[0].hours,'Monday: Closed');}finally{global.fetch=old;delete process.env.GOOGLE_API_KEY;}
});
test('invalid coordinates rejected',async()=>{for(const lat of ['', '91', 'abc']){const r=response();await places({query:{cat:'food',lat,lng:'77'}},r);assert.equal(r.code,400);}});
test('OSM hours retained without invented ratings',async()=>{const old=global.fetch;global.fetch=async()=>({ok:true,json:async()=>({elements:[{type:'node',id:12,lat:12,lon:77,tags:{name:'Cafe',opening_hours:'24/7'}}]})});
 try{const r=response();await places({query:{cat:'food',lat:'12',lng:'77'}},r);assert.equal(r.body.places[0].rating,null);assert.equal(r.body.places[0].hours,'24/7');}finally{global.fetch=old;}
});
test('crowd write requires admin, validates status, timestamp expires',async()=>{
 let saved;const oldSet=store.setCrowd,oldGet=store.crowd;store.setCrowd=async(id,v)=>{saved=v;};store.crowd=async()=>saved;
 try{let r=response();await crowd({method:'POST',headers:{},body:{id:'osm:node:12',status:'Crowded'}},r);assert.equal(r.code,401);
 r=response();await crowd({method:'POST',headers:{'x-admin-password':process.env.ADMIN_PASSWORD||'admin123'},body:{id:'osm:node:12',status:'Crowded'}},r);assert.equal(r.code,200);assert.equal(Date.parse(saved.expiresAt)-Date.parse(saved.updatedAt),3600000);
 r=response();await crowd({method:'GET',query:{id:'osm:node:12'}},r);assert.equal(r.body.crowd.status,'Crowded');
 r=response();await crowd({method:'POST',headers:{'x-admin-password':process.env.ADMIN_PASSWORD||'admin123'},body:{id:'osm:node:12',status:'fake'}},r);assert.equal(r.code,400);
 }finally{store.setCrowd=oldSet;store.crowd=oldGet;}
});
test('frontend parses and contains no continuous tracking or sharing banner',()=>{
 for(const file of ['index','admin']){const html=fs.readFileSync(__dirname+'/../public/'+file+'.html','utf8');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);}
 const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');assert.doesNotMatch(html,/watchPosition|Share my live location|Stop sharing/);assert.match(html,/if \(\$\("#saveVisit"\).checked\) fetch/);assert.match(html,/Rating unavailable/);
});
