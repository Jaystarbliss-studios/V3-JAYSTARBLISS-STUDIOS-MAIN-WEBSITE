import type { Handler } from "@netlify/functions";
import { adminAuth, adminDb } from "../../api/_lib/firebase-admin";
import { getPaymentConfig, getUserRecord, normaliseRole, isStaffRole, isActiveRecord } from "../../api/_lib/billing";
import { createPortalNotification } from "../../api/_lib/email";

const tokenFromEvent = (event: any) => {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};
const json = (statusCode: number, body: Record<string, unknown>) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const token = tokenFromEvent(event);
    if (!token) return json(401, { error: "Authentication required." });
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await getUserRecord(decoded.uid);
    const role = normaliseRole(user.role);
    if (!isStaffRole(role) || !isActiveRecord(user)) return json(403, { error: "Only active tutors and staff can use the staff wallet." });

    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").toLowerCase();
    const walletRef = adminDb.collection("staffWallets").doc(decoded.uid);

    if (action === "save_bank") {
      const accountNumber = String(body.accountNumber || "").replace(/\D/g, "");
      const bankCode = String(body.bankCode || "").trim();
      if (!/^\d{10}$/.test(accountNumber) || !/^\d{3,6}$/.test(bankCode)) return json(400, { error: "Enter a valid 10-digit account number and bank code." });
      if (!process.env.PAYSTACK_SECRET_KEY) return json(503, { error: "Payment gateway is not configured." });

      const resolveResponse = await fetch(`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });
      const resolveData = await resolveResponse.json();
      if (!resolveResponse.ok || !resolveData.status || !resolveData.data?.account_name) {
        return json(400, { error: "The bank account could not be verified." });
      }

      await walletRef.set({
        bankAccountName: String(resolveData.data.account_name),
        bankCode,
        bankAccountNumber: accountNumber,
        bankAccountLast4: accountNumber.slice(-4),
        bankDetailsVerified: true,
        bankDetailsUpdatedAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      return json(200, { saved: true, accountName: resolveData.data.account_name, last4: accountNumber.slice(-4) });
    }

    if (action === "withdraw") {
      const amount = Number(body.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: "Enter a valid withdrawal amount." });
      const config = await getPaymentConfig();
      const minimum = Number(config.minimumWithdrawalAmount || 10000);
      if (amount < minimum) return json(400, { error: `Minimum withdrawal is ₦${minimum.toLocaleString()}.` });
      if (!process.env.PAYSTACK_SECRET_KEY) return json(503, { error: "Automatic withdrawals are not configured yet." });

      const withdrawalRef = adminDb.collection("walletWithdrawals").doc();
      const transferReference = `jbs_${withdrawalRef.id}`.slice(0, 50).toLowerCase();
      const reservation = await adminDb.runTransaction(async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        const userSnap = await transaction.get(adminDb.collection("users").doc(decoded.uid));
        const wallet = walletSnap.exists ? walletSnap.data() || {} : {};
        const profile = userSnap.exists ? userSnap.data() || {} : {};
        const available = Number(wallet.availableBalance || 0);
        const reserved = Number(wallet.reservedBalance || 0);
        if (available < amount) throw new Error("INSUFFICIENT_BALANCE");
        if (!wallet.bankDetailsVerified || !wallet.bankAccountNumber || !wallet.bankCode) throw new Error("BANK_DETAILS_REQUIRED");

        transaction.set(walletRef, { availableBalance: available - amount, reservedBalance: reserved + amount, updatedAt: new Date() }, { merge: true });
        transaction.create(withdrawalRef, {
          staffId: decoded.uid,
          staffName: profile.name || profile.displayName || decoded.email || "Staff",
          amount,
          currency: "NGN",
          status: "PROCESSING",
          transferReference,
          bankLast4: wallet.bankAccountLast4,
          bankCode: wallet.bankCode,
          accountName: wallet.bankAccountName,
          createdAt: new Date()
        });
        return { amount, bankCode: String(wallet.bankCode), accountNumber: String(wallet.bankAccountNumber), accountName: String(wallet.bankAccountName || profile.name || "Staff") };
      });

      const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "nuban", name: reservation.accountName, account_number: reservation.accountNumber, bank_code: reservation.bankCode, currency: "NGN" })
      });
      const recipientData = await recipientResponse.json();
      if (!recipientResponse.ok || !recipientData.status || !recipientData.data?.recipient_code) {
        await releaseReservation(withdrawalRef.id, decoded.uid, amount, "Recipient creation failed");
        return json(502, { error: "The payout bank account could not be registered with Paystack." });
      }

      await withdrawalRef.update({ recipientCode: recipientData.data.recipient_code });
      const transferResponse = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: "balance", amount: Math.round(reservation.amount * 100), recipient: recipientData.data.recipient_code, reference: transferReference, reason: "Jaystarbliss Studios staff wallet withdrawal", currency: "NGN" })
      });
      const transferData = await transferResponse.json();
      if (!transferResponse.ok || !transferData.status) {
        await releaseReservation(withdrawalRef.id, decoded.uid, amount, "Transfer initiation failed");
        return json(502, { error: transferData.message || "The automatic withdrawal could not be initiated." });
      }

      const transferStatus = String(transferData.data?.status || "pending").toUpperCase();
      if (transferStatus === "OTP") {
        await releaseReservation(withdrawalRef.id, decoded.uid, amount, "Paystack transfer requires OTP confirmation");
        return json(409, { error: "Paystack requires transfer confirmation. Automatic withdrawals require transfer OTP to be disabled in the Paystack account." });
      }

      await withdrawalRef.update({ transferCode: transferData.data?.transfer_code || null, transferId: transferData.data?.id || null, providerStatus: transferStatus, providerMessage: transferData.message || null, updatedAt: new Date() });
      if (transferStatus === "SUCCESS") await finaliseSuccessfulWithdrawal(withdrawalRef.id, decoded.uid, amount);

      await createPortalNotification({ recipientId: decoded.uid, email: decoded.email, title: "Staff withdrawal initiated", message: `Your ₦${amount.toLocaleString()} wallet withdrawal has been sent to the verified account ending ${reservation.accountNumber.slice(-4)}.`, type: "WALLET_WITHDRAWAL", data: { withdrawalId: withdrawalRef.id, reference: transferReference, amount } });
      return json(200, { submitted: true, withdrawalId: withdrawalRef.id, status: transferStatus || "PROCESSING" });
    }

    return json(400, { error: "Unsupported wallet action." });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INSUFFICIENT_BALANCE") return json(400, { error: "Your available wallet balance is not enough for this withdrawal." });
    if (code === "BANK_DETAILS_REQUIRED") return json(400, { error: "Save and verify your bank account before requesting a withdrawal." });
    console.error("Wallet action failed:", error);
    return json(500, { error: "Unable to complete the wallet request." });
  }
};

async function releaseReservation(withdrawalId: string, staffId: string, amount: number, reason: string) {
  const walletRef = adminDb.collection("staffWallets").doc(staffId);
  await adminDb.runTransaction(async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const wallet = walletSnap.exists ? walletSnap.data() || {} : {};
    transaction.set(walletRef, { availableBalance: Number(wallet.availableBalance || 0) + amount, reservedBalance: Math.max(0, Number(wallet.reservedBalance || 0) - amount), updatedAt: new Date() }, { merge: true });
    transaction.update(adminDb.collection("walletWithdrawals").doc(withdrawalId), { status: "FAILED", failureReason: reason, updatedAt: new Date() });
  });
}

async function finaliseSuccessfulWithdrawal(withdrawalId: string, staffId: string, amount: number) {
  const walletRef = adminDb.collection("staffWallets").doc(staffId);
  await adminDb.runTransaction(async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const wallet = walletSnap.exists ? walletSnap.data() || {} : {};
    transaction.set(walletRef, { reservedBalance: Math.max(0, Number(wallet.reservedBalance || 0) - amount), updatedAt: new Date() }, { merge: true });
    transaction.update(adminDb.collection("walletWithdrawals").doc(withdrawalId), { status: "PAID", paidAt: new Date(), updatedAt: new Date() });
  });
}

export { releaseReservation, finaliseSuccessfulWithdrawal };
