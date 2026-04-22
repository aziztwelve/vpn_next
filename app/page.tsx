'use client';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">VPN Service</h1>
        
        <div className="bg-slate-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Привет, Aziz!</h2>
          <p className="text-slate-400">Добро пожаловать в VPN Mini App</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Активная подписка</h3>
          <p className="text-green-400">✓ 1 месяц</p>
          <p className="text-slate-400 text-sm">До 5 устройств</p>
          <p className="text-slate-400 text-sm mt-2">
            Истекает: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <a href="/plans" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 text-center transition">
            Тарифы
          </a>
          <a href="/history" className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg p-4 text-center transition">
            История
          </a>
        </div>
      </div>
    </div>
  );
}
