import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { getUserRecord, normaliseRole } from "../../api/_lib/billing";

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

const response = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(body)
});

const isSuperAdmin = (email: string, role: string) =>
  email === "johnrufai242@gmail.com" ||
  ["superadmin", "super_admin", "admin"].includes(role);

const SCHOOL_SCOPED_COLLECTIONS = [
  "users",
  "students",
  "individualStudents",
  "studentModules",
  "personalResources",
  "personalLinks",
  "schoolResources",
  "schoolLinks",
  "schoolExams",
  "schoolPasscodes",
  "schoolPrograms",
  "payments",
  "calendarEvents",
  "notifications",
  "staffSchoolAccess",
  "parents",
  "enrollment_requests",
  "student_requests",
  "courseProgress",
  "studentProgress",
  "activityLogs",
  "tutorSettlements"
];

async function deleteQueryResults(
  collectionName: string,
  schoolId: string
) {
  const snapshot = await adminDb
    .collection(collectionName)
    .where("schoolId", "==", schoolId)
    .get();

  if (snapshot.empty) return 0;

  let deleted = 0;
  const refs = snapshot.docs.map((document) => document.ref);

  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += Math.min(450, refs.length - i);
  }

  return deleted;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method Not Allowed" });
  }

  try {
    const token = tokenFromEvent(event);
    if (!token) return response(401, { error: "Authentication required." });

    const decoded = await adminAuth.verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    const adminUser = await getUserRecord(decoded.uid, email);
    const role = normaliseRole(adminUser.role);

    if (!isSuperAdmin(email, role)) {
      return response(403, { error: "Only the super admin can manage partner schools." });
    }

    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").trim().toLowerCase();
    const schoolId = String(body.schoolId || "").trim();

    if (!schoolId) return response(400, { error: "School ID is required." });

    const schoolRef = adminDb.collection("schools").doc(schoolId);

    if (action === "update_profile") {
      const allowedFields = [
        "name",
        "schoolCode",
        "contactName",
        "contactEmail",
        "phone",
        "state",
        "address",
        "status",
        "notes"
      ];

      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates[field] = typeof body[field] === "string"
            ? body[field].trim()
            : body[field];
        }
      }

      if (!updates.name || !updates.contactEmail) {
        return response(400, { error: "School name and administrator email are required." });
      }

      updates.updatedAt = new Date();
      updates.updatedBy = decoded.uid;

      await schoolRef.set(updates, { merge: true });

      return response(200, { updated: true, schoolId });
    }

    if (action === "delete_school") {
      const confirmation = String(body.confirmation || "").trim();
      const schoolSnapshot = await schoolRef.get();

      if (!schoolSnapshot.exists) {
        return response(404, { error: "School was not found." });
      }

      const school = schoolSnapshot.data() || {};
      const schoolName = String(school.name || schoolId);

      if (confirmation !== schoolName) {
        return response(400, {
          error: "Confirmation does not match the school name.",
          expectedConfirmation: schoolName
        });
      }

      const deletedCounts: Record<string, number> = {};
      const authUids: string[] = [];

      // Collect linked user accounts before deleting their Firestore records.
      const usersSnapshot = await adminDb
        .collection("users")
        .where("schoolId", "==", schoolId)
        .get();

      usersSnapshot.docs.forEach((userDoc) => authUids.push(userDoc.id));

      for (const collectionName of SCHOOL_SCOPED_COLLECTIONS) {
        deletedCounts[collectionName] = await deleteQueryResults(collectionName, schoolId);
      }

      await schoolRef.delete();

      // Remove linked Firebase Authentication accounts after their portal records are gone.
      let deletedAuthUsers = 0;
      for (const uid of authUids) {
        try {
          await adminAuth.deleteUser(uid);
          deletedAuthUsers += 1;
        } catch (error: any) {
          // A missing auth account is already in the desired state.
          if (error?.code !== "auth/user-not-found") {
            console.warn("Unable to delete linked auth user:", uid, error);
          }
        }
      }

      await adminDb.collection("activityLogs").add({
        type: "SCHOOL_DELETED",
        action: "delete_school",
        schoolId,
        schoolName,
        deletedBy: decoded.uid,
        deletedByEmail: email,
        deletedAt: FieldValue.serverTimestamp(),
        deletedCounts,
        deletedAuthUsers
      });

      return response(200, {
        deleted: true,
        schoolId,
        schoolName,
        deletedCounts,
        deletedAuthUsers
      });
    }

    return response(400, { error: "Unsupported school administration action." });
  } catch (error) {
    console.error("School administration action failed:", error);
    return response(500, { error: "Unable to complete the school administration request." });
  }
};
