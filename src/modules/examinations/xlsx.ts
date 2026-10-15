import { createZip, type ZipFile } from "./zip";
function xml(value:unknown){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function column(index:number){let n=index+1;let label="";while(n){const r=(n-1)%26;label=String.fromCharCode(65+r)+label;n=Math.floor((n-1)/26);}return label;}
export function createXlsx(rows:(string|number|null|undefined)[][],sheetName="JDI Exam Results"):Uint8Array{
 let safeName=sheetName; for (const ch of ["\\","/","?", "*", "[", "]", ":"]) safeName=safeName.split(ch).join(" "); safeName=safeName.slice(0,31)||"Results";
 const sheetRows=rows.map((row,ri)=>"<row r=\""+(ri+1)+"\">"+row.map((value,ci)=>{const ref=column(ci)+(ri+1);if(typeof value==="number"&&Number.isFinite(value))return "<c r=\""+ref+"\" t=\"n\"><v>"+value+"</v></c>";return "<c r=\""+ref+"\" t=\"inlineStr\"><is><t xml:space=\"preserve\">"+xml(value)+"</t></is></c>";}).join("")+"</row>").join("");
 const sheet="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheetData>"+sheetRows+"</sheetData></worksheet>";
 const files:ZipFile[]=[
 {name:"[Content_Types].xml",data:new TextEncoder().encode("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>")},
 {name:"_rels/.rels",data:new TextEncoder().encode("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>")},
 {name:"xl/workbook.xml",data:new TextEncoder().encode("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\""+xml(safeName)+"\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>")},
 {name:"xl/_rels/workbook.xml.rels",data:new TextEncoder().encode("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>")},
 {name:"xl/worksheets/sheet1.xml",data:new TextEncoder().encode(sheet)}
 ];
 return createZip(files);
}
