import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function localDatabase(path){
 mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 db.exec(readFileSync(new URL('../auth-migrations/0001-accounts.sql',import.meta.url),'utf8'));
 return {prepare(sql){const stmt=db.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){const result=stmt.run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};},close(){db.close();}};
}
