'use client';

import { useEffect, useState } from 'react';
import { vpnApi, SubscriptionPlan, DevicePrice } from '@/lib/api';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

export default function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [devicePricing, setDevicePricing] = useState<DevicePrice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        const plansData = await vpnApi.listPlans(true);
        setPlans(plansData);
        if (plansData.length > 0) {
          setSelectedPlan(plansData[0]);
          const pricing = await vpnApi.getDevicePricing(plansData[0].id);
          setDevicePricing(pricing);
        }
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки тарифов:', err);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        setLoading(false);
      }
    }

    loadPlans();
  }, []);

  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    try {
      const pricing = await vpnApi.getDevicePricing(plan.id);
      setDevicePricing(pricing);
      setSelectedDevices(2);
    } catch (err) {
      console.error('Ошибка загрузки цен:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Загрузка тарифов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 inline-block">
            Назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Выбор тарифа</h1>
        </div>

        <div className="grid gap-4 mb-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => handlePlanSelect(plan)}
              className={`bg-slate-900 rounded-lg p-6 border-2 cursor-pointer transition ${
                selectedPlan?.id === plan.id ? 'border-blue-500' : 'border-slate-800 hover:border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-slate-400 text-sm">{plan.duration_months} {plan.duration_months === 1 ? 'месяц' : plan.duration_months < 5 ? 'месяца' : 'месяцев'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{plan.base_price} ₽</p>
                  <p className="text-slate-400 text-sm">за период</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-sm text-slate-300">
                  <Check className="w-4 h-4 mr-2 text-green-400" />
                  До {plan.max_devices} устройств
                </div>
                <div className="flex items-center text-sm text-slate-300">
                  <Check className="w-4 h-4 mr-2 text-green-400" />
                  Безлимитный трафик
                </div>
                <div className="flex items-center text-sm text-slate-300">
                  <Check className="w-4 h-4 mr-2 text-green-400" />
                  4 локации (USA, DE, SG, JP)
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedPlan && devicePricing.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Дополнительные устройства</h3>
            <p className="text-slate-400 text-sm mb-4">
              Базовый тариф включает 2 устройства. Вы можете добавить больше.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {devicePricing.slice(0, 6).map((price) => (
                <div
                  key={price.max_devices}
                  onClick={() => setSelectedDevices(price.max_devices)}
                  className={`rounded-lg p-3 text-center cursor-pointer transition ${
                    selectedDevices === price.max_devices
                      ? 'bg-blue-600'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <p className="text-sm text-slate-300">{price.max_devices} устройств</p>
                  <p className="text-lg font-semibold">+{price.additional_price} ₽</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedPlan && (
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-4 font-semibold text-lg transition">
            Оплатить {selectedPlan.base_price} ₽
          </button>
        )}
      </div>
    </div>
  );
}
