import {passwordHash} from '../backend/api.mjs';
export default {async fetch(){try{const digest=await passwordHash('test-only-password','test-only-salt');return Response.json({ok:digest.length===64});}catch{return Response.json({ok:false},{status:500});}}};
