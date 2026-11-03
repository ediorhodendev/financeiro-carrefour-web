// Explicit, isolated visual fixture. Never included in the Docker runtime.
import { createGateway } from '../server/gateway.mjs';
import { randomUUID } from 'node:crypto';
const accountId='c90a3c2c-cdeb-4df0-85cb-d1a299a0d101';
const token='demo.'+Buffer.from(JSON.stringify({sub:'demo-customer',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.preview';
let entries=[{id:randomUUID(),sequence:1,type:1,amount:100,registeredAt:'2026-11-02T22:37:33Z',reversalOf:null},{id:randomUUID(),sequence:2,type:2,amount:30,registeredAt:'2026-11-02T23:04:38Z',reversalOf:null}];
const keys=new Map();
async function fixture(url,init={}){
 const path=new URL(url).pathname;
 if(path==='/health/ready')return new Response('Healthy');
 if(path==='/demo/access')return Response.json({accountId,token,expiresInSeconds:3600});
 if(!init.headers?.Authorization&&!init.headers?.authorization)return new Response('',{status:401});
 if(path.includes('/api/queues/'))return Response.json({messages:0,messages_ready:0,messages_unacknowledged:0,consumers:0,message_stats:{publish_details:{rate:0},deliver_get_details:{rate:0},ack_details:{rate:0}}});
 const balance=()=>({accountId,currency:'BRL',amount:entries.reduce((sum,e)=>sum+(e.type===1?e.amount:-e.amount),0),at:null,lastSequence:entries.length,processedAt:new Date().toISOString()});
 if(path==='/api/v1/clientes/me/saldo')return Response.json({customerId:'demo-customer',...balance(),accounts:[balance()]});
 if(path.endsWith('/saldo'))return Response.json(balance());
 if(path.endsWith('/extrato'))return Response.json({items:entries,page:1,size:8,total:entries.length,lastSequence:entries.length});
 if(path.includes('/lancamentos')&&init.method==='POST'){
  const key=init.headers['idempotency-key'];if(keys.has(key))return Response.json(keys.get(key),{status:201,headers:{'Idempotency-Replayed':'true'}});
  const body=JSON.parse(init.body.toString());const original=entries.find(e=>path.includes(e.id));
  const entry={id:randomUUID(),accountId,sequence:entries.length+1,type:original?(original.type===1?2:1):body.tipo==='Credito'?1:2,amount:original?.amount??body.valor,registeredAt:new Date().toISOString(),reversalOf:original?.id??null};entries.push(entry);keys.set(key,entry);return Response.json(entry,{status:201});
 }
 return new Response('',{status:404});
}
const portIndex=process.argv.indexOf('--port');
createGateway({mode:'preview',fetcher:fixture,user:'preview',password:'preview'}).listen(Number(process.env.PORT||(portIndex>=0?process.argv[portIndex+1]:4200)),'0.0.0.0',()=>console.log('EXPLICIT VISUAL PREVIEW: simulated data, not a financial backend.'));
