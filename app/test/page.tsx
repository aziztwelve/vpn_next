'use client';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Тестовая страница</h1>
      <p>Если ты видишь это - Next.js работает!</p>
      <div className="mt-4">
        <p>Время: {new Date().toLocaleString('ru-RU')}</p>
      </div>
    </div>
  );
}
