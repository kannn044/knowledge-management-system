/**
 * Handles the redirect from Google OAuth.
 * The backend redirects to /auth/callback?token=<accessToken>
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-toastify';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      toast.error(decodeURIComponent(error));
      navigate('/login', { replace: true });
      return;
    }

    if (token) {
      sessionStorage.setItem('accessToken', token);
      refreshUser().then(() => {
        navigate('/dashboard', { replace: true });
      });
    } else {
      navigate('/login', { replace: true });
    }
  }, [params, navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <p className="text-sm text-slate-500">Signing you in with Google...</p>
      </div>
    </div>
  );
}
