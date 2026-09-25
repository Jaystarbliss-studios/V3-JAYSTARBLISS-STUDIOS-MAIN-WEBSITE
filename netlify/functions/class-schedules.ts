import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(body)
});

const classes = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "JSS 1", "JSS 2", "JSS 3", "SS1", "SS2", "SS3"];
const statuses = ["SCHEDULED", "ONGOING", "COMPLETED", "ATTENDED", "ABSENT", "CANCELLED", "RESCHEDULED"];

const tokenFrom = (event: any) => {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
};

const requireUser = async (event: any) => {
  const token = tokenFrom(event);
  if (!token) throw new Error("AUTH_REQUIRED");
  const decoded = await adminAuth.verifyIdToken(token);
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  const user = snap.exists ? (snap.data() || {}) : {};
  return { decoded, user, uid: decoded.uid };
};

const adminRole = (role: any) => ["ADMIN", "SUPER_ADMIN", "EDUCATION_ADMIN", "CMS_ADMIN"].includes(String(role || "").toUpperCase());
const tutorRole = (role: any) => ["TUTOR", "STAFF", "INSTRUCTOR", "FACULTY"].includes(String(role || "").toUpperCase());

const normalizeClasses = (body: any) => {
  const raw = Array.isArray(body.classLevels) ? body.classLevels : (body.classLevel ? [body.classLevel] : []);
  const valid = raw.map((v: any) => String(v).trim()).filter((v: string) => classes.includes(v));
  return Array.from(new Set(valid));
};

const dateFor = (startDate: string, index: number) => {
  const d = new Date(startDate + "T00:00:00");
  d.setDate(d.getDate() + index * 7);
  return d.toISOString().slice(0, 10);
};

export const handler: Handler = async event => {
  try {
    const { user, uid } = await requireUser(event);
    const method = event.httpMethod || "GET";
    const params = event.queryStringParameters || {};
    const role = String(user.role || "").toUpperCase();

    if (method === "GET") {
      const requestedSchoolId = String(params.schoolId || "").trim();
      const requestedStudentId = String(params.studentId || "").trim();
      const requestedTutorId = String(params.tutorId || "").trim();

      const snap = await adminDb.collection("classSchedules").limit(4000).get();
      let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Role-based filtering
      if (role === "SCHOOL") {
        let schoolId = String(user.schoolId || "").trim();
        let schoolName = String(user.schoolName || user.name || "").trim();

        if (!schoolId) {
          const sDoc = await adminDb.collection("schools").doc(uid).get();
          if (sDoc.exists) {
            schoolId = sDoc.id;
            schoolName = sDoc.data()?.name || schoolName;
          } else {
            const userEmail = (user.email || decoded.email || "").toLowerCase();
            if (userEmail) {
              const byEmail = await adminDb.collection("schools").where("contactEmail", "==", userEmail).limit(1).get();
              if (!byEmail.empty) {
                schoolId = byEmail.docs[0].id;
                schoolName = byEmail.docs[0].data()?.name || schoolName;
              } else {
                const byEmail2 = await adminDb.collection("schools").where("email", "==", userEmail).limit(1).get();
                if (!byEmail2.empty) {
                  schoolId = byEmail2.docs[0].id;
                  schoolName = byEmail2.docs[0].data()?.name || schoolName;
                }
              }
            }
          }
        }

        const sidLower = schoolId.toLowerCase();
        const snameLower = schoolName.toLowerCase();

        records = records.filter((r: any) => {
          const rSchoolId = String(r.schoolId || "").trim().toLowerCase();
          const rSchoolName = String(r.schoolName || "").trim().toLowerCase();
          if (sidLower && (rSchoolId === sidLower || rSchoolId === uid.toLowerCase())) return true;
          if (snameLower && rSchoolName && (rSchoolName === snameLower || rSchoolName.includes(snameLower) || snameLower.includes(rSchoolName))) return true;
          if (requestedSchoolId && rSchoolId === requestedSchoolId.toLowerCase()) return true;
          return false;
        });
      } else if (role === "STUDENT") {
        const studentSchoolId = String(user.schoolId || "").trim();
        const studentClass = String(user.class || user.grade || "").trim();
        records = records.filter((r: any) => {
          if (r.targetType === "STUDENT" && (r.studentId === uid || r.studentEmail === user.email)) return true;
          if (studentSchoolId && String(r.schoolId || "") === studentSchoolId) {
            if (studentClass && (r.classLevel === studentClass || (Array.isArray(r.classLevels) && r.classLevels.includes(studentClass)))) {
              return true;
            }
            return !r.classLevel && (!r.classLevels || r.classLevels.length === 0);
          }
          return false;
        });
      } else if (role === "PARENT") {
        const parentId = uid;
        records = records.filter((r: any) => r.parentId === parentId || r.parentEmail === user.email);
      } else if (tutorRole(role) && !adminRole(role)) {
        // Tutor can see schedules assigned to them
        records = records.filter((r: any) => {
          if (r.tutorId === uid) return true;
          if (user.name && r.tutorName && String(r.tutorName).toLowerCase() === String(user.name).toLowerCase()) return true;
          if (user.displayName && r.tutorName && String(r.tutorName).toLowerCase() === String(user.displayName).toLowerCase()) return true;
          return false;
        });
      } else if (adminRole(role)) {
        if (requestedSchoolId) records = records.filter((r: any) => String(r.schoolId || "") === requestedSchoolId);
        if (requestedStudentId) records = records.filter((r: any) => String(r.studentId || "") === requestedStudentId);
        if (requestedTutorId) records = records.filter((r: any) => String(r.tutorId || "") === requestedTutorId);
      }

      records.sort((a: any, b: any) => 
        String(a.date || "").localeCompare(String(b.date || "")) || 
        String(a.startTime || "").localeCompare(String(b.startTime || ""))
      );

      const groups = new Map<string, any>();
      records.forEach((r: any) => {
        const gid = String(r.scheduleGroupId || r.id);
        const existing = groups.get(gid);
        if (!existing) {
          groups.set(gid, {
            scheduleGroupId: gid,
            targetType: r.targetType || "SCHOOL",
            schoolId: r.schoolId,
            schoolName: r.schoolName,
            studentId: r.studentId,
            studentName: r.studentName,
            parentId: r.parentId,
            title: r.title,
            tutorId: r.tutorId,
            tutorName: r.tutorName,
            startDate: r.startDate || r.date,
            startTime: r.startTime,
            endTime: r.endTime,
            recurring: r.recurring !== false,
            weeks: r.occurrenceTotal || 1,
            classLevels: Array.isArray(r.classLevels) ? r.classLevels : (r.classLevel ? [r.classLevel] : []),
            occurrences: []
          });
        }
        groups.get(gid).occurrences.push(r);
      });

      return json(200, { schedules: records, groups: Array.from(groups.values()), classes });
    }

    // Creating Schedules (POST)
    if (method === "POST") {
      if (!adminRole(role) && !tutorRole(role)) {
        return json(403, { error: "Only authorised administrators and faculty can create class schedules." });
      }

      const body = JSON.parse(event.body || "{}");
      const targetType = String(body.targetType || "SCHOOL").toUpperCase(); // SCHOOL or STUDENT
      const title = String(body.title || "").trim();
      const tutorId = String(body.tutorId || (tutorRole(role) ? uid : "")).trim();
      const tutorName = String(body.tutorName || (tutorRole(role) ? (user.name || user.displayName || "Faculty") : "")).trim();
      const startDate = String(body.startDate || "").trim();
      const startTime = String(body.startTime || "").trim();
      const endTime = String(body.endTime || "").trim();
      const recurring = body.recurring !== false;
      const weeks = Math.min(52, Math.max(1, Number(body.weeks || 52)));

      if (!title || !startDate || !startTime || !endTime) {
        return json(400, { error: "Title, start date, start time, and end time are required." });
      }

      const groupId = adminDb.collection("classSchedules").doc().id;
      const count = recurring ? weeks : 1;
      let batch = adminDb.batch();
      let writes = 0;

      if (targetType === "STUDENT") {
        const studentId = String(body.studentId || "").trim();
        const studentName = String(body.studentName || "").trim();
        const parentId = String(body.parentId || "").trim();
        const studentEmail = String(body.studentEmail || "").trim();

        if (!studentId && !studentName) {
          return json(400, { error: "Private student name or student ID is required." });
        }

        for (let i = 0; i < count; i++) {
          const ref = adminDb.collection("classSchedules").doc();
          batch.set(ref, {
            scheduleGroupId: groupId,
            targetType: "STUDENT",
            studentId,
            studentName,
            parentId,
            studentEmail,
            title,
            tutorId,
            tutorName,
            date: dateFor(startDate, i),
            startDate,
            startTime,
            endTime,
            status: "SCHEDULED",
            recurring,
            recurrence: recurring ? "WEEKLY" : "ONCE",
            occurrenceNumber: i + 1,
            occurrenceTotal: count,
            createdBy: uid,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          writes++;
          if (writes >= 450) {
            await batch.commit();
            batch = adminDb.batch();
            writes = 0;
          }
        }
      } else {
        // School Schedule
        const schoolId = String(body.schoolId || "").trim();
        const schoolName = String(body.schoolName || "").trim();
        const classLevels = normalizeClasses(body);

        if (!schoolId || !classLevels.length) {
          return json(400, { error: "School and at least one class level are required for school schedules." });
        }

        const schoolSnap = await adminDb.collection("schools").doc(schoolId).get();
        const resolvedSchoolName = schoolName || (schoolSnap.exists ? String(schoolSnap.data()?.name || "School") : "School");

        for (let i = 0; i < count; i++) {
          for (const classLevel of classLevels) {
            const ref = adminDb.collection("classSchedules").doc();
            batch.set(ref, {
              scheduleGroupId: groupId,
              targetType: "SCHOOL",
              schoolId,
              schoolName: resolvedSchoolName,
              classLevel,
              classLevels,
              title,
              tutorId,
              tutorName,
              date: dateFor(startDate, i),
              startDate,
              startTime,
              endTime,
              status: "SCHEDULED",
              recurring,
              recurrence: recurring ? "WEEKLY" : "ONCE",
              occurrenceNumber: i + 1,
              occurrenceTotal: count,
              createdBy: uid,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            writes++;
            if (writes >= 450) {
              await batch.commit();
              batch = adminDb.batch();
              writes = 0;
            }
          }
        }
      }

      if (writes) await batch.commit();
      return json(201, { created: true, scheduleGroupId: groupId, occurrences: count });
    }

    // Updating Schedules (PATCH)
    if (method === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const scheduleId = String(body.scheduleId || "").trim();
      const scheduleGroupId = String(body.scheduleGroupId || "").trim();
      const status = String(body.status || "").toUpperCase();

      // Occurrence status update (e.g. mark Ongoing, Attended, Absent, Cancelled, Rescheduled)
      if (status && scheduleId) {
        if (!statuses.includes(status)) return json(400, { error: "A valid schedule status is required." });
        const ref = adminDb.collection("classSchedules").doc(scheduleId);
        const snap = await ref.get();
        if (!snap.exists) return json(404, { error: "Class schedule occurrence not found." });

        const updateData: any = {
          status,
          updatedAt: new Date(),
          updatedBy: uid
        };

        if (status === "ABSENT") {
          updateData.absenceReason = String(body.absenceReason || body.reason || "Absent").trim();
        } else if (status === "RESCHEDULED") {
          updateData.rescheduleReason = String(body.rescheduleReason || body.reason || "Rescheduled").trim();
          updateData.rescheduledDate = String(body.rescheduledDate || body.newDate || "").trim();
          updateData.rescheduledStartTime = String(body.rescheduledStartTime || body.newStartTime || "").trim();
          updateData.rescheduledEndTime = String(body.rescheduledEndTime || body.newEndTime || "").trim();
        } else if (status === "CANCELLED") {
          updateData.cancellationReason = String(body.cancellationReason || body.reason || "Cancelled").trim();
        }

        await ref.set(updateData, { merge: true });
        return json(200, { updated: true, scheduleId, status });
      }

      // Bulk group update
      if (!scheduleGroupId) return json(400, { error: "A recurring schedule group is required." });
      const groupSnap = await adminDb.collection("classSchedules").where("scheduleGroupId", "==", scheduleGroupId).get();
      if (groupSnap.empty) return json(404, { error: "Recurring schedule not found." });

      const first = groupSnap.docs[0].data();
      const title = String(body.title || first.title || "").trim();
      const tutorName = String(body.tutorName ?? first.tutorName ?? "").trim();
      const tutorId = String(body.tutorId ?? first.tutorId ?? "").trim();
      const startTime = String(body.startTime || first.startTime || "").trim();
      const endTime = String(body.endTime || first.endTime || "").trim();
      const startDate = String(body.startDate || first.startDate || first.date || "").trim();
      const weeks = Math.min(52, Math.max(1, Number(body.weeks || first.occurrenceTotal || 1)));

      let batch = adminDb.batch();
      let writes = 0;
      let changed = 0;

      for (const d of groupSnap.docs) {
        batch.set(d.ref, {
          title,
          tutorName,
          tutorId,
          startTime,
          endTime,
          occurrenceTotal: weeks,
          updatedAt: new Date(),
          updatedBy: uid
        }, { merge: true });
        writes++;
        changed++;
        if (writes >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          writes = 0;
        }
      }

      if (writes) await batch.commit();
      return json(200, { updated: true, changed, scheduleGroupId });
    }

    return json(405, { error: "Method Not Allowed" });
  } catch (error: any) {
    const code = String(error?.message || "");
    if (code === "AUTH_REQUIRED" || code.includes("auth/")) return json(401, { error: "Authentication required." });
    if (code === "PROFILE_NOT_FOUND") return json(403, { error: "Authoritative portal profile not found." });
    console.error("Class schedules error:", error);
    return json(500, { error: "Unable to process class schedules." });
  }
};
