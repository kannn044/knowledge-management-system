import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="card w-full max-w-md text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Awaiting Approval</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Your account has been registered and your email verified. An administrator
          will review and activate your account. You'll receive an email once approved.
        </p>
        <Link to="/login" className="btn-secondary w-full">Back to Sign In</Link>
      </div>
    </div>
  );
}
