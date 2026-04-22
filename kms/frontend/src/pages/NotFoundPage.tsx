import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-primary-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-slate-500 text-sm mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
      </div>
    </div>
  );
}
