import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/services/authApi';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (token) {
      authApi.verifyEmail(token)
        .then(() => setStatus('success'))
        .catch(() => setStatus('error'));
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="card w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto mb-3" />
            <p className="text-slate-600">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Email Verified!</h2>
            <p className="text-sm text-slate-500 mb-5">
              Your account is now awaiting admin approval. You'll be notified by email once activated.
            </p>
            <Link to="/pending-approval" className="btn-primary w-full">View Status</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Verification Failed</h2>
            <p className="text-sm text-slate-500 mb-5">
              This link is invalid or has expired. Please try registering again.
            </p>
            <Link to="/register" className="btn-primary w-full">Register Again</Link>
          </>
        )}
      </div>
    </div>
  );
}
