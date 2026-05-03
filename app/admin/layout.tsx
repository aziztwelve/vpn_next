'use client';

// ─────────────────────────────────────────────────────────────────
// Admin area guard. Редиректит любого не-admin'а на главную.
//
// Клиентский guard здесь — для UX (чтобы не отрисовывать «пустое»
// состояние). Реальная авторизация — на бэкенде через middleware
// RequireAdmin (см. services/gateway/internal/middleware/admin.go).
// Без admin-роли API-ручки вернут 403 независимо от того что показывает UI.
// ─────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && user && user.role !== 'admin') {
      router.replace('/');
    }
  }, [status, user, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    // Редирект уже в полёте — возвращаем null чтобы не моргать контентом.
    return null;
  }

  return <div className="min-h-screen pb-20">{children}</div>;
}
