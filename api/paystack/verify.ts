import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../_lib/firebase-admin';

function getBearer(req: any) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = await adminAuth.verifyIdToken(token);
    const reference = String(req.body?.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'Payment reference is required' });

    const snapshot = await adminDb.collection('payments')
      .where('reference', '==', reference)
      .where('userId', '==', decoded.uid)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Payment record not found' });

    const paymentDoc = snapshot.docs[0];
    const payment = paymentDoc.data();

    if (payment.status === 'VERIFIED') {
      return res.status(200).json({ verified: true, reference, status: 'VERIFIED' });
    }

    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`
      }
    });

    const data = await paystackResponse.json();
    const transaction = data?.data;

    const expectedSubunit = Number(payment.amountSubunit);
    const verified = Boolean(
      paystackResponse.ok &&
      data?.status &&
      transaction?.status === 'success' &&
      transaction?.reference === reference &&
      Number(transaction?.amount) === expectedSubunit &&
      String(transaction?.currency || 'NGN').toUpperCase() === 'NGN'
    );

    if (!verified) {
      await paymentDoc.ref.update({
        status: transaction?.status ? String(transaction.status).toUpperCase() : 'VERIFICATION_FAILED',
        providerMessage: data?.message || transaction?.gateway_response || 'Payment could not be verified',
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.status(402).json({ verified: false, error: 'Payment could not be verified' });
    }

    await paymentDoc.ref.update({
      status: 'VERIFIED',
      providerStatus: transaction.status,
      paymentMethod: transaction.channel || null,
      providerTransactionId: transaction.id || null,
      paidAt: transaction.paid_at || null,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedAmountSubunit: transaction.amount,
      gatewayResponse: transaction.gateway_response || null
    });

    await adminDb.collection('activityLogs').add({
      type: 'payment_verified',
      actorUid: decoded.uid,
      userEmail: decoded.email?.toLowerCase() || '',
      paymentId: paymentDoc.id,
      reference,
      amount: payment.amount,
      timestamp: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      verified: true,
      reference,
      status: 'VERIFIED',
      amount: payment.amount,
      paymentMethod: transaction.channel || null
    });
  } catch (error: any) {
    console.error('Paystack verification error:', error);
    return res.status(500).json({ error: 'Unable to verify payment securely' });
  }
}
