export type ZipFile = { name: string; data: Uint8Array };
const crcTable = (() => { const table = new Uint32Array(256); for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
function crc32(data:Uint8Array){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
function u16(view:DataView,offset:number,value:number){view.setUint16(offset,value,true);}
function u32(view:DataView,offset:number,value:number){view.setUint32(offset,value>>>0,true);}
export function createZip(files:ZipFile[]):Uint8Array{
 const encoder=new TextEncoder();const localParts:Uint8Array[]=[];const centralParts:Uint8Array[]=[];let offset=0;
 for(const file of files){const name=encoder.encode(file.name.replace(/\\/g,"/"));const data=file.data;const crc=crc32(data);const local=new Uint8Array(30+name.length);const lv=new DataView(local.buffer);u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0);u16(lv,8,0);u16(lv,10,0);u16(lv,12,0);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);u16(lv,28,0);local.set(name,30);localParts.push(local,data);
 const central=new Uint8Array(46+name.length);const cv=new DataView(central.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0);u16(cv,10,0);u16(cv,12,0);u16(cv,14,0);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);central.set(name,46);centralParts.push(central);offset+=local.length+data.length;}
 const centralSize=centralParts.reduce((n,p)=>n+p.length,0);const end=new Uint8Array(22);const ev=new DataView(end.buffer);u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
 const all=[...localParts,...centralParts,end];const out=new Uint8Array(all.reduce((n,p)=>n+p.length,0));let cursor=0;for(const part of all){out.set(part,cursor);cursor+=part.length;}return out;
}
