'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error?.message || t.forgot_error_default);
      }
    } catch (error) {
      setError(t.forgot_error_network);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t.forgot_success_title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t.forgot_success_desc}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t.login_btn_back_to_login}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.login_btn_back_to_login}
          </Link>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t.forgot_title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center">{t.forgot_subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t.forgot_label_email}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t.forgot_placeholder_email}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.forgot_btn_submitting}
              </>
            ) : (
              t.forgot_btn_submit
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
