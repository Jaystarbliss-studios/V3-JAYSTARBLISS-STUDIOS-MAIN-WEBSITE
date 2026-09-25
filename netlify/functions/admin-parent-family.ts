import type { Handler } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";

const ADMIN_ROLES = new Set([
  "super_admin",
  "cms_admin",
  "academic_admin",
  "finance_admin",
  "content_admin",
  "education_admin",
  "services_admin",
  "admin",
  "director"
]);

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const getBearerToken = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

const temporaryPassword = () => `Jb!${randomBytes(15).toString("base64url")}9#`;

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

const findStudent = async (child: any) => {
  const id = String(child?.id || "").trim();
  const username = normalize(child?.username);
  const fullName = normalize(child?.fullName || child?.studentName);
  const collections = ["individualStudents", "students", "enrollment_requests"];

  if (id) {
    for (const collectionName of collections) {
      const snap = await adminDb.collection(collectionName).doc(id).get();
      if (snap.exists) return { collectionName, id: snap.id, data: snap.data() || {} };
    }
  }

  for (const collectionName of collections) {
    if (username) {
      const snap = await adminDb.collection(collectionName).where("username", "==", username).limit(1).get();
      if (!snap.empty) return { collectionName, id: snap.docs[0].id, data: snap.docs[0].data() || {} };
    }
    if (fullName) {
      const snap = await adminDb.collection(collectionName).where("fullName", "==", child.fullName || child.studentName).limit(1).get();
      if (!snap.empty) return { collectionName, id: snap.docs[0].id, data: snap.docs[0].data() || {} };
      const studentNameSnap = await adminDb.collection(collectionName).where("studentName", "==", child.fullName || child.studentName).limit(1).get();
      if (!studentNameSnap.empty) return { collectionName, id: studentNameSnap.docs[0].id, data: studentNameSnap.docs[0].data() || {} };
    }
  }

  return null;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  let createdAuthUserUid = "";

  try {
    const token = getBearerToken(event);
    if (!token) return json(401, { error: "Authentication required." });

    const decoded = await adminAuth.verifyIdToken(token);
    const callerProfile = (await adminDb.collection("users").doc(decoded.uid).get()).data() || {};
    const callerRole = normalize(callerProfile.role);
    const callerIsAdminDoc = (await adminDb.collection("admins").doc(decoded.uid).get()).exists;

    if (!ADMIN_ROLES.has(callerRole) && !callerIsAdminDoc) {
      return json(403, { error: "Administrator permissions are required." });
    }

    const body = JSON.parse(event.body || "{}");
    const parentName = String(body.parentName || body.name || "").trim();
    const parentEmail = normalize(body.parentEmail || body.email);
    const parentPhone = String(body.parentPhone || body.phone || "").trim();
    const children = Array.isArray(body.children) ? body.children : [];

    if (!parentName || !parentEmail || !parentEmail.includes("@")) {
      return json(400, { error: "A valid parent name and email are required." });
    }

    // Resolve all requested children before creating/updating the parent account.
    const resolvedChildren = [] as Array<{ collectionName: string; id: string; data: Record<string, any>; requested: any }>;
    for (const child of children) {
      const resolved = await findStudent(child);
      if (!resolved) {
        return json(404, {
          error: `Student could not be found: ${child?.fullName || child?.studentName || child?.username || child?.id || "unknown student"}.`,
          student: child
        });
      }
      resolvedChildren.push({ ...resolved, requested: child });
    }

    let authUser;
    let isNewAuthUser = false;
    let generatedPassword: string | null = null;

    try {
      authUser = await adminAuth.getUserByEmail(parentEmail);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") throw error;
      generatedPassword = temporaryPassword();
      authUser = await adminAuth.createUser({
        email: parentEmail,
        password: generatedPassword,
        displayName: parentName,
        emailVerified: false,
        disabled: false
      });
      createdAuthUserUid = authUser.uid;
      isNewAuthUser = true;
    }

    const now = new Date();
    const parentProfile = {
      uid: authUser.uid,
      email: parentEmail,
      name: parentName,
      displayName: parentName,
      fullName: parentName,
      phone: parentPhone,
      role: "parent",
      roles: ["parent"],
      isParent: true,
      accountStatus: "ACTIVE",
      status: "ACTIVE",
      forcePasswordReset: isNewAuthUser,
      updatedAt: now
    };

    await adminDb.collection("users").doc(authUser.uid).set({ ...parentProfile, createdAt: now }, { merge: true });
    await adminDb.collection("parents").doc(authUser.uid).set({ ...parentProfile, children: [] }, { merge: true });

    const batch = adminDb.batch();
    const linkedStudentIds: string[] = [];

    for (const child of resolvedChildren) {
      const childData = child.data || {};
      const linked = {
        parentId: authUser.uid,
        parentEmail,
        parentName,
        parentPhone,
        studentType: childData.studentType === "school" ? childData.studentType : "parent",
        updatedAt: now
      };

      for (const collectionName of ["individualStudents", "students", "enrollment_requests"]) {
        batch.set(adminDb.collection(collectionName).doc(child.id), linked, { merge: true });
      }

      linkedStudentIds.push(child.id);
    }

    if (linkedStudentIds.length) {
      batch.set(adminDb.collection("parents").doc(authUser.uid), {
        ...parentProfile,
        children: linkedStudentIds,
        childrenCount: linkedStudentIds.length
      }, { merge: true });
    }

    await batch.commit();

    return json(200, {
      success: true,
      parent: {
        uid: authUser.uid,
        email: parentEmail,
        name: parentName,
        children: linkedStudentIds
      },
      created: isNewAuthUser,
      temporaryPassword: generatedPassword,
      forcePasswordReset: isNewAuthUser,
      message: isNewAuthUser
        ? "Parent account created and children linked. Share the temporary password securely and require the parent to change it after sign-in."
        : "Existing parent account updated and children linked."
    });
  } catch (error: any) {
    if (createdAuthUserUid) {
      try { await adminAuth.deleteUser(createdAuthUserUid); } catch (cleanupError) { console.error("Parent account rollback failed:", cleanupError); }
    }
    console.error("Admin parent-family provisioning error:", error);
    return json(500, { error: "Unable to provision the parent family securely." });
  }
};
