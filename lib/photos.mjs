export async function photoJpeg(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPEG・PNG・WebPの写真を選んでください。');
 if(file.size>20*1024*1024)throw new Error('元の写真は20MB以内にしてください。');
 const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));if(!blob||blob.size>5242880)throw new Error('写真の変換に失敗しました。');return blob;}finally{bitmap.close();}
}
