import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const json = (statusCode:number, body:Record<string,unknown>) => ({
  statusCode,
  headers: { "Content-Type":"application/json", "Cache-Control":"no-store" },
  body: JSON.stringify(body)
});

const classes = ["Year 1","Year 2","Year 3","Year 4","Year 5","JSS 1","JSS 2","JSS 3","SS1","SS2","SS3"];
const statuses = ["SCHEDULED","COMPLETED","ATTENDED","ABSENT","CANCELLED","RESCHEDULED"];

const tokenFrom = (event:any) => {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
};

const requireUser = async (event:any) => {
  const token = tokenFrom(event);
  if (!token) throw new Error("AUTH_REQUIRED");
  const decoded = await adminAuth.verifyIdToken(token);
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!snap.exists) throw new Error("PROFILE_NOT_FOUND");
  const user = snap.data() || {};
  return { decoded, user, uid: decoded.uid };
};

const adminRole = (role:any) => ["ADMIN","SUPER_ADMIN","EDUCATION_ADMIN"].includes(String(role || "").toUpperCase());

export const handler: Handler = async event => {
  try {
    const { user, uid } = await requireUser(event);
    const method = event.httpMethod || "GET";
    const params = event.queryStringParameters || {};

    if (method === "GET") {
      const requestedSchoolId = String(params.schoolId || "").trim();
      const role = String(user.role || "").toLowerCase();
      const schoolId = role === "school" ? String(user.schoolId || "").trim() : requestedSchoolId;

      if (role === "school" && !schoolId) return json(400,{error:"Your school account is not linked to a school."});

      // Keep the read index-free: schedules are a small operational dataset and
      // are sorted in memory after applying the school scope.
      const snap = await adminDb.collection("classSchedules").limit(1000).get();
      const records = snap.docs
        .map(d => ({ id:d.id, ...d.data() }))
        .filter((record:any) => !schoolId || String(record.schoolId || "") === schoolId)
        .sort((a:any,b:any) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.startTime || "").localeCompare(String(b.startTime || "")));
      return json(200,{ schedules: records, classes });
    }

    if (!adminRole(user.role)) return json(403,{error:"Only authorised administrators can manage class schedules."});

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const schoolId = String(body.schoolId || "").trim();
      const schoolName = String(body.schoolName || "").trim();
      const classLevel = String(body.classLevel || "").trim();
      const title = String(body.title || "").trim();
      const tutorName = String(body.tutorName || "").trim();
      const startDate = String(body.startDate || "").trim();
      const startTime = String(body.startTime || "").trim();
      const endTime = String(body.endTime || "").trim();
      const recurring = body.recurring !== false;
      const weeks = Math.min(52, Math.max(1, Number(body.weeks || 52)));

      if (!schoolId || !classLevel || !classes.includes(classLevel) || !title || !startDate || !startTime || !endTime) {
        return json(400,{error:"School, class, title, date and class times are required."});
      }

      const schoolSnap = await adminDb.collection("schools").doc(schoolId).get();
      if (!schoolSnap.exists) return json(404,{error:"Selected school record was not found."});
      const resolvedSchoolName = schoolName || String(schoolSnap.data()?.name || schoolSnap.data()?.schoolName || "School");
      const groupId = adminDb.collection("classSchedules").doc().id;
      const count = recurring ? weeks : 1;
      const batch = adminDb.batch();

      for (let i=0;i<count;i++) {
        const d = new Date(startDate + "T00:00:00");
        d.setDate(d.getDate() + i * 7);
        const date = d.toISOString().slice(0,10);
        const ref = adminDb.collection("classSchedules").doc();
        batch.set(ref,{
          scheduleGroupId: groupId,
          schoolId,
          schoolName: resolvedSchoolName,
          classLevel,
          title,
          tutorName,
          date,
          startTime,
          endTime,
          status:"SCHEDULED",
          recurring,
          recurrence:"WEEKLY",
          occurrenceNumber:i+1,
          occurrenceTotal:count,
          createdBy:uid,
          createdAt:new Date(),
          updatedAt:new Date()
        });
      }
      await batch.commit();
      return json(201,{created:true,scheduleGroupId:groupId,occurrences:count});
    }

    if (method === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const scheduleId = String(body.scheduleId || "").trim();
      const status = String(body.status || "").toUpperCase();
      if (!scheduleId || !statuses.includes(status)) return json(400,{error:"A valid schedule and status are required."});
      const ref = adminDb.collection("classSchedules").doc(scheduleId);
      const snap = await ref.get();
      if (!snap.exists) return json(404,{error:"Class schedule occurrence not found."});
      await ref.set({status, updatedAt:new Date(), updatedBy:uid}, {merge:true});
      return json(200,{updated:true});
    }

    return json(405,{error:"Method Not Allowed"});
  } catch (error:any) {
    const code = String(error?.message || "");
    if (code === "AUTH_REQUIRED" || code.includes("auth/")) return json(401,{error:"Authentication required."});
    if (code === "PROFILE_NOT_FOUND") return json(403,{error:"Authoritative portal profile not found."});
    console.error("Class schedules error:",error);
    return json(500,{error:"Unable to process class schedules."});
  }
};