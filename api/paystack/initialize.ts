import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../_lib/firebase-admin';

const PLANS: Record<string, number> = {
  'Weekend STEM & Coding Track': 45000,
  '1-on-1 Intensive Mentorship': 120000,
  'Smart Robotics & IoT Hardware Lab': 85000,
  'Institutional STEM Lab Partner': 350000,
  'CBT Exam Portal & Lab Suite': 600000
};

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
    const { plan, role: requestedRole } = req.body || {};
    const amountNaira = PLANS[String(plan || '')];
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const storedRole = String(userData.role || (decoded as any).role || '').toLowerCase();
    const role = storedRole.includes('school') ? 'school'
      : storedRole.includes('parent') ? 'parent'
      : storedRole.includes('student') ? 'student'
      : '';
    const normalizedRequestedRole = String(requestedRole || '').toLowerCase();

    if (!amountNaira) return res.status(400).json({ error: 'Invalid payment plan' });
    if (!decoded.email) return res.status(400).json({ error: 'Authenticated email is required' });
    if (!role || role !== normalizedRequestedRole) return res.status(403).json({ error: 'Portal role does not match the authenticated account.' });

    const schoolPlans = new Set(['Institutional STEM Lab Partner', 'CBT Exam Portal & Lab Suite']);
    const studentPlans = new Set(['Weekend STEM & Coding Track', '1-on-1 Intensive Mentorship', 'Smart Robotics & IoT Hardware Lab']);
    if ((role === 'school' && !schoolPlans.has(String(plan))) || (role !== 'school' && !studentPlans.has(String(plan)))) {
      return res.status(400).json({ error: 'That plan is not available for this portal account.' });
    }

    const reference = `JBL-${Date.now()}-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const amountSubunit = amountNaira * 100;

    const paymentRef = adminDb.collection('payments').doc();
    await paymentRef.set({
      userId: decoded.uid,
      email: decoded.email.toLowerCase(),
      plan,
      role: String(role || 'student').toUpperCase(),
      amount: amountNaira,
      amountSubunit,
      reference,
      status: 'PENDING',
      paymentProvider: 'PAYSTACK',
      createdAt: FieldValue.serverTimestamp()
    });

    const publicAppUrl = process.env.PUBLIC_APP_URL || req.headers.origin || '';
    const callbackUrl = publicAppUrl ? `${publicAppUrl.replace(/\/$/, '')}/portal/${String(role || 'student').toLowerCase()}/payments?payment=complete` : undefined;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: decoded.email,
        amount: String(amountSubunit),
        currency: 'NGN',
        reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: {
          userId: decoded.uid,
          plan,
          role: String(role || 'student').toUpperCase(),
          paymentDocumentId: paymentRef.id
        }
      })
    });

    const data = await paystackResponse.json();
    if (!paystackResponse.ok || !data?.status) {
      await paymentRef.update({
        status: 'INITIALIZATION_FAILED',
        providerMessage: data?.message || 'Paystack initialization failed',
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.status(502).json({ error: data?.message || 'Unable to initialize payment' });
    }

    await paymentRef.update({
      accessCode: data.data.access_code,
      authorizationUrl: data.data.authorization_url,
      initializedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      accessCode: data.data.access_code,
      authorizationUrl: data.data.authorization_url,
      reference
    });
  } catch (error: any) {
    console.error('Paystack initialization error:', error);
    return res.status(500).json({ error: 'Unable to initialize payment securely' });
  }
}
