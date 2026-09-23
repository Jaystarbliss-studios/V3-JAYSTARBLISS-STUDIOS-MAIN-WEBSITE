import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const json=(statusCode:number,body:Record<string,unknown>)=>({statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(body)});
const classes=["Year 1","Year 2","Year 3","Year 4","Year 5","JSS 1","JSS 2","JSS 3","SS1","SS2","SS3"];
const statuses=["SCHEDULED","COMPLETED","ATTENDED","ABSENT","CANCELLED","RESCHEDULED"];
const tokenFrom=(event:any)=>{const h=event.headers?.authorization||event.headers?.Authorization||"";return h.startsWith("Bearer ")?h.slice(7):""};
const requireUser=async(event:any)=>{const token=tokenFrom(event);if(!token)throw new Error("AUTH_REQUIRED");const decoded=await adminAuth.verifyIdToken(token);const snap=await adminDb.collection("users").doc(decoded.uid).get();if(!snap.exists)throw new Error("PROFILE_NOT_FOUND");return{decoded,user:snap.data()||{},uid:decoded.uid}};
const adminRole=(role:any)=>["ADMIN","SUPER_ADMIN","EDUCATION_ADMIN"].includes(String(role||"").toUpperCase());
const normalizeClasses=(body:any)=>{
  const raw=Array.isArray(body.classLevels)?body.classLevels:(body.classLevel?[body.classLevel]:[]);
  const valid=raw.map((v:any)=>String(v).trim()).filter((v:string)=>classes.includes(v));
  return Array.from(new Set(valid));
};
const dateFor=(startDate:string,index:number)=>{const d=new Date(startDate+"T00:00:00");d.setDate(d.getDate()+index*7);return d.toISOString().slice(0,10)};

export const handler:Handler=async event=>{
 try{
  const {user,uid}=await requireUser(event); const method=event.httpMethod||"GET"; const params=event.queryStringParameters||{};
  if(method==="GET"){
   const requestedSchoolId=String(params.schoolId||"").trim(); const role=String(user.role||"").toLowerCase();
   const schoolId=role==="school"?String(user.schoolId||"").trim():requestedSchoolId;
   if(role==="school"&&!schoolId)return json(400,{error:"Your school account is not linked to a school."});
   const snap=await adminDb.collection("classSchedules").limit(3000).get();
   const records=snap.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>!schoolId||String(r.schoolId||"")===schoolId)
     .sort((a:any,b:any)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.startTime||"").localeCompare(String(b.startTime||"")));
   const groups=new Map<string,any>();
   records.forEach((r:any)=>{
     const gid=String(r.scheduleGroupId||r.id);
     const existing=groups.get(gid);
     if(!existing){groups.set(gid,{scheduleGroupId:gid,schoolId:r.schoolId,schoolName:r.schoolName,title:r.title,tutorName:r.tutorName,startDate:r.startDate||r.date,startTime:r.startTime,endTime:r.endTime,recurring:r.recurring!==false,weeks:r.occurrenceTotal||1,classLevels:Array.isArray(r.classLevels)?r.classLevels:(r.classLevel?[r.classLevel]:[]),occurrences:[]});}
     groups.get(gid).occurrences.push(r);
   });
   return json(200,{schedules:records,groups:Array.from(groups.values()),classes});
  }
  if(!adminRole(user.role))return json(403,{error:"Only authorised administrators can manage class schedules."});

  if(method==="POST"){
   const body=JSON.parse(event.body||"{}"); const schoolId=String(body.schoolId||"").trim(); const schoolName=String(body.schoolName||"").trim();
   const title=String(body.title||"").trim(); const tutorName=String(body.tutorName||"").trim(); const startDate=String(body.startDate||"").trim();
   const startTime=String(body.startTime||"").trim(); const endTime=String(body.endTime||"").trim(); const recurring=body.recurring!==false;
   const weeks=Math.min(52,Math.max(1,Number(body.weeks||52))); const classLevels=normalizeClasses(body);
   if(!schoolId||!classLevels.length||!title||!startDate||!startTime||!endTime)return json(400,{error:"School, at least one class, title, date and class times are required."});
   const schoolSnap=await adminDb.collection("schools").doc(schoolId).get(); if(!schoolSnap.exists)return json(404,{error:"Selected school record was not found."});
   const resolvedSchoolName=schoolName||String(schoolSnap.data()?.name||schoolSnap.data()?.schoolName||"School"); const groupId=adminDb.collection("classSchedules").doc().id;
   const count=recurring?weeks:1; let batch=adminDb.batch(); let writes=0;
   for(let i=0;i<count;i++)for(const classLevel of classLevels){
    const ref=adminDb.collection("classSchedules").doc();
    batch.set(ref,{scheduleGroupId:groupId,schoolId,schoolName:resolvedSchoolName,classLevel,classLevels,title,tutorName,date:dateFor(startDate,i),startDate,startTime,endTime,status:"SCHEDULED",recurring,recurrence:recurring?"WEEKLY":"ONCE",occurrenceNumber:i+1,occurrenceTotal:count,createdBy:uid,createdAt:new Date(),updatedAt:new Date()});
    writes++; if(writes>=450){await batch.commit();batch=adminDb.batch();writes=0;}
   }
   if(writes)await batch.commit();
   return json(201,{created:true,scheduleGroupId:groupId,occurrences:count,classOccurrences:count*classLevels.length});
  }

  if(method==="PATCH"){
   const body=JSON.parse(event.body||"{}"); const scheduleId=String(body.scheduleId||"").trim(); const scheduleGroupId=String(body.scheduleGroupId||"").trim();
   const status=String(body.status||"").toUpperCase();
   if(status&&scheduleId){
    if(!statuses.includes(status))return json(400,{error:"A valid schedule status is required."});
    const ref=adminDb.collection("classSchedules").doc(scheduleId);const snap=await ref.get();if(!snap.exists)return json(404,{error:"Class schedule occurrence not found."});
    await ref.set({status,updatedAt:new Date(),updatedBy:uid},{merge:true});return json(200,{updated:true});
   }
   if(!scheduleGroupId)return json(400,{error:"A recurring schedule group is required."});
   const groupSnap=await adminDb.collection("classSchedules").where("scheduleGroupId","==",scheduleGroupId).get();
   if(groupSnap.empty)return json(404,{error:"Recurring schedule not found."});
   const first=groupSnap.docs[0].data(); const classLevels=normalizeClasses(body); if(!classLevels.length)return json(400,{error:"Select at least one class."});
   const title=String(body.title||first.title||"").trim(), tutorName=String(body.tutorName??first.tutorName??"").trim();
   const startTime=String(body.startTime||first.startTime||"").trim(), endTime=String(body.endTime||first.endTime||"").trim();
   const startDate=String(body.startDate||first.startDate||first.date||"").trim(); const weeks=Math.min(52,Math.max(1,Number(body.weeks||first.occurrenceTotal||1)));
   if(!title||!startDate||!startTime||!endTime)return json(400,{error:"Title, date and times are required."});
   const oldDocs=groupSnap.docs; const oldByKey=new Map(oldDocs.map(d=>[String(d.data().date||"")+"|"+String(d.data().classLevel||""),d]));
   const desiredKeys=new Set<string>(); let batch=adminDb.batch();let writes=0;let changed=0;
   for(let i=0;i<weeks;i++)for(const classLevel of classLevels){
     const date=dateFor(startDate,i);const key=date+"|"+classLevel;desiredKeys.add(key);const existing=oldByKey.get(key);
     if(existing){
       batch.set(existing.ref,{title,tutorName,startDate,startTime,endTime,classLevel,classLevels,occurrenceNumber:i+1,occurrenceTotal:weeks,updatedAt:new Date(),updatedBy:uid},{merge:true});changed++;
     }else{
       const ref=adminDb.collection("classSchedules").doc();batch.set(ref,{scheduleGroupId,schoolId:first.schoolId,schoolName:first.schoolName,classLevel,classLevels,title,tutorName,date,startDate,startTime,endTime,status:"SCHEDULED",recurring:true,recurrence:"WEEKLY",occurrenceNumber:i+1,occurrenceTotal:weeks,createdBy:first.createdBy||uid,createdAt:first.createdAt||new Date(),updatedAt:new Date(),updatedBy:uid});changed++;
     }
     writes++;if(writes>=450){await batch.commit();batch=adminDb.batch();writes=0;}
   }
   for(const d of oldDocs){const data=d.data();const key=String(data.date||"")+"|"+String(data.classLevel||"");if(!desiredKeys.has(key)){batch.delete(d.ref);writes++;changed++;if(writes>=450){await batch.commit();batch=adminDb.batch();writes=0;}}}
   if(writes)await batch.commit();
   return json(200,{updated:true,changed,scheduleGroupId});
  }
  return json(405,{error:"Method Not Allowed"});
 }catch(error:any){const code=String(error?.message||"");if(code==="AUTH_REQUIRED"||code.includes("auth/"))return json(401,{error:"Authentication required."});if(code==="PROFILE_NOT_FOUND")return json(403,{error:"Authoritative portal profile not found."});console.error("Class schedules error:",error);return json(500,{error:"Unable to process class schedules."});}
};