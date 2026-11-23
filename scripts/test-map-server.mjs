// Local-only UI fixture. No writes to Supabase and no real user/location data.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let owner='fixture-a';
const rows=[{spot_slug:'noma',visited:true,visited_on:'2026-10-10'},{spot_slug:'irago',visited:true,visited_on:'2026-10-11'}];
const json=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/session')return json(res,{user:owner?{id:owner,username:owner}:null});
 if(path==='/api/login'){for await(const c of req){}owner='fixture-b';return json(res,{user:{id:owner,username:owner}});}
 if(path==='/api/logout'){owner=null;return json(res,{user:null});}
 if(path==='/api/visits')return json(res,owner==='fixture-a'?rows:[]);
 if(path==='/api/memories')return json(res,owner==='fixture-a'?rows.map((v,i)=>({...v,id:String(i),photo_count:i+1,created_at:'2026-10-11'})):[]);
 if(path==='/api/photos')return json(res,[{id:'0',created_at:'2026-10-11'}]);
 if(path.startsWith('/api/photos/'))return json(res,{jpeg:(await readFile(new URL('images/spots/noma.jpg',root))).toString('base64')});
 if(path==='/fixture-geolocation.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(`Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,failure){if(new URLSearchParams(location.search).has('denied'))failure({code:1});else success({coords:{latitude:35.6812,longitude:139.7671,accuracy:25}});}}});`);}
 if(path==='/mobile'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<iframe title="mobile" src="/" style="width:390px;height:850px"></iframe>');}
 const file=path==='/'?'index.html':path.slice(1);
 if(file.includes('..')||!(/^(index.html|app.js|styles.css|icon.svg|supabase-config.json)$/.test(file)||/^(lib|vendor|images\/spots|data)\/[a-zA-Z0-9/_.-]+$/.test(file))){res.writeHead(404);return res.end();}
 let body=await readFile(new URL(file,root));if(file==='index.html')body=Buffer.from(body.toString('utf8').replace('<script src="app.js"','<script src="/fixture-geolocation.js"></script><script src="app.js"'));
 res.writeHead(200,{'Content-Type':({html:'text/html; charset=utf-8',js:'text/javascript',mjs:'text/javascript',json:'application/json',css:'text/css',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml'})[file.split('.').at(-1)],'Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(500);res.end('fixture error');}}).listen(8790,'127.0.0.1',()=>console.log('UI fixture: http://127.0.0.1:8790 (synthetic user and Tokyo location)'));
