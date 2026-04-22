import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Loader2, ArrowLeft } from 'lucide-react';
import { authApi } from '@/services/authApi';
import { toast } from 'react-toastify';

const schema = z.object({ email: z.string().email('Invalid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    try {
      await authApi.forgotPassword(email);
    } catch {
      // Always show success to prevent email enumeration
    }
  };

  if (isSubmitSuccessful) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
        <div className="w-full max-w-md text-center">
          <div className="card">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-5">
              If an account exists for that email, a temporary password has been sent.
            </p>
            <Link to="/login" className="btn-primary w-full">Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-3">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Forgot Password?</h1>
          <p className="text-slate-500 mt-1 text-sm">We'll send you a temporary password</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input {...register('email')} type="email" placeholder="you@organization.com" className="input" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send Temporary Password
            </button>
          </form>
        </div>
        <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mt-5">
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}
