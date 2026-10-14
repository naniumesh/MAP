const store=require('../lib/store');
const {isAdmin}=require('../lib/handlers');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {
    if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
    if(req.method==='POST' && !isAdmin(req)) return res.status(401).json({error:'Unauthorized'});
    const body=req.method==='POST' ? (typeof req.body==='string'?JSON.parse(req.body):req.body || {}) : req.query;
    const id=body.id;
    if(typeof id!=='string' || !/^(osm|google):[a-zA-Z0-9_:-]{1,180}$/.test(id)) return res.status(400).json({error:'Valid place ID required'});
    if(req.method==='GET') return res.status(200).json({crowd:await store.crowd(id)});
    if(!['Quiet','Moderate','Busy','Crowded'].includes(body.status)) return res.status(400).json({error:'Invalid crowd status'});
    const now=Date.now();
    const crowd={status:body.status,source:'Admin report',updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+3600000).toISOString()};
    await store.setCrowd(id,crowd); return res.status(200).json({crowd});
  } catch { return res.status(503).json({error:'Crowd status unavailable'}); }
};
