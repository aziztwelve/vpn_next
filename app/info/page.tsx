'use client'

import { useState } from 'react'
import { X, FileText, Shield, Mail, MessageCircle } from 'lucide-react'

type ModalType = 'privacy' | 'terms' | 'support' | null

export default function InfoPage() {
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const openModal = (type: ModalType) => setActiveModal(type)
  const closeModal = () => setActiveModal(null)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Информация</h1>

        <div className="space-y-4">
          {/* Политика конфиденциальности */}
          <button
            onClick={() => openModal('privacy')}
            className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl p-6 flex items-center gap-4 transition-colors"
          >
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-lg">Политика конфиденциальности</h3>
              <p className="text-slate-400 text-sm">Как мы обрабатываем ваши данные</p>
            </div>
          </button>

          {/* Пользовательское соглашение */}
          <button
            onClick={() => openModal('terms')}
            className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl p-6 flex items-center gap-4 transition-colors"
          >
            <div className="bg-purple-500/10 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-lg">Пользовательское соглашение</h3>
              <p className="text-slate-400 text-sm">Условия использования сервиса</p>
            </div>
          </button>

          {/* Поддержка */}
          <button
            onClick={() => openModal('support')}
            className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl p-6 flex items-center gap-4 transition-colors"
          >
            <div className="bg-green-500/10 p-3 rounded-lg">
              <MessageCircle className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-lg">Поддержка</h3>
              <p className="text-slate-400 text-sm">Свяжитесь с нами</p>
            </div>
          </button>
        </div>

        {/* Версия приложения */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>MaydaVPN v1.0.0</p>
          <p className="mt-1">© 2026 Все права защищены</p>
        </div>
      </div>

      {/* Модальные окна */}
      {activeModal && (
        <Modal onClose={closeModal}>
          {activeModal === 'privacy' && <PrivacyPolicy />}
          {activeModal === 'terms' && <TermsOfService />}
          {activeModal === 'support' && <SupportContacts />}
        </Modal>
      )}
    </div>
  )
}

// Компонент модального окна
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Заголовок с кнопкой закрытия */}
        <div className="flex justify-end p-4 border-b border-slate-800">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент с прокруткой */}
        <div className="overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Политика конфиденциальности
function PrivacyPolicy() {
  return (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-2xl font-bold mb-4">Политика конфиденциальности</h2>
      
      <p className="text-slate-300 mb-4">
        Последнее обновление: 1 апреля 2026 г.
      </p>

      <p className="text-slate-300 mb-4">
        Политика конфиденциальности регулирует сбор, использование и защиту информации 
        пользователей сервиса. Собираются идентификаторы аккаунта, техническая информация 
        и история взаимодействий. Данные используются для обеспечения работы сервиса, связи 
        с пользователем и анализа. Передача информации третьим лицам возможна только в 
        законодательно установленных случаях или с согласия пользователя.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">1. Общие положения</h3>
      <p className="text-slate-300 mb-2">
        1.1. Настоящая Политика конфиденциальности (далее — «Политика») регулирует порядок 
        обработки и защиты информации, которую Пользователь передаёт при использовании 
        сервиса (далее — «Сервис»).
      </p>
      <p className="text-slate-300">
        1.2. Используя Сервис, Пользователь подтверждает своё согласие с условиями Политики. 
        Если Пользователь не согласен с условиями — он обязан прекратить использование Сервиса.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">2. Сбор информации</h3>
      <p className="text-slate-300 mb-2">2.1. Сервис может собирать следующие типы данных:</p>
      <ul className="text-slate-300 space-y-2">
        <li>идентификаторы аккаунта (логин, ID, никнейм и т.п.);</li>
        <li>техническую информацию (IP-адрес, данные о браузере, устройстве и операционной системе);</li>
        <li>историю взаимодействий с Сервисом.</li>
      </ul>
      <p className="text-slate-300 mt-2">
        2.2. Сервис не требует от Пользователя предоставления паспортных данных, документов, 
        фотографий или другой личной информации, кроме минимально необходимой для работы.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">3. Использование информации</h3>
      <p className="text-slate-300 mb-2">3.1. Сервис может использовать полученную информацию исключительно для:</p>
      <ul className="text-slate-300 space-y-2">
        <li>обеспечения работы функционала;</li>
        <li>связи с Пользователем (в том числе для уведомлений и поддержки);</li>
        <li>анализа и улучшения работы Сервиса.</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">4. Передача информации третьим лицам</h3>
      <p className="text-slate-300 mb-2">
        4.1. Администрация не передаёт полученные данные третьим лицам, за исключением случаев:
      </p>
      <ul className="text-slate-300 space-y-2">
        <li>если это требуется по закону;</li>
        <li>если это необходимо для исполнения обязательств перед Пользователем (например, при работе с платёжными системами);</li>
        <li>если Пользователь сам дал на это согласие.</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">5. Хранение и защита данных</h3>
      <p className="text-slate-300 mb-2">
        5.1. Данные хранятся в течение срока, необходимого для достижения целей обработки.
      </p>
      <p className="text-slate-300">
        5.2. Администрация принимает разумные меры для защиты данных, но не гарантирует 
        абсолютную безопасность информации при передаче через интернет.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">6. Отказ от ответственности</h3>
      <p className="text-slate-300 mb-2">
        6.1. Пользователь понимает и соглашается, что передача информации через интернет 
        всегда сопряжена с рисками.
      </p>
      <p className="text-slate-300">
        6.2. Администрация не несёт ответственности за утрату, кражу или раскрытие данных, 
        если это произошло по вине третьих лиц или самого Пользователя.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">7. Изменения в Политике</h3>
      <p className="text-slate-300 mb-2">
        7.1. Администрация вправе изменять условия Политики без предварительного уведомления.
      </p>
      <p className="text-slate-300">
        7.2. Продолжение использования Сервиса после внесения изменений означает согласие 
        Пользователя с новой редакцией Политики.
      </p>
    </div>
  )
}

// Пользовательское соглашение
function TermsOfService() {
  return (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-2xl font-bold mb-4">Пользовательское соглашение</h2>
      
      <p className="text-slate-300 mb-4">
        Последнее обновление: 1 апреля 2019 г.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">1. Общие положения</h3>
      <p className="text-slate-300 mb-2">
        1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует порядок 
        использования онлайн-сервиса (далее — «Сервис»), предоставляемого Администрацией.
      </p>
      <p className="text-slate-300 mb-2">
        1.2. Используя Сервис, включая запуск бота, регистрацию, оплату услуг или получение доступа 
        к материалам, Пользователь подтверждает, что полностью ознакомился с условиями настоящего 
        Соглашения и принимает их в полном объёме.
      </p>
      <p className="text-slate-300">
        1.3. В случае несогласия с условиями Соглашения Пользователь обязан прекратить использование Сервиса.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">2. Характер услуг и цифровых товаров</h3>
      <p className="text-slate-300 mb-2">
        2.1. Сервис предоставляет цифровые товары и услуги нематериального характера, включая, но не 
        ограничиваясь: информационные материалы, обучающие программы, консультации, цифровые продукты 
        и сервисные услуги.
      </p>
      <p className="text-slate-300 mb-2">2.2. Материалы, предоставляемые через Сервис, могут включать:</p>
      <ul className="text-slate-300 space-y-2">
        <li>информацию из открытых источников;</li>
        <li>авторские материалы Администрации и/или третьих лиц;</li>
        <li>аналитические обзоры, подборки, рекомендации, структурированные данные.</li>
      </ul>
      <p className="text-slate-300 mb-2">
        2.3. Пользователь осознаёт и соглашается, что ценность цифровых товаров и услуг Сервиса 
        заключается в систематизации, анализе, форме подачи, сопровождении, поддержке и обновлениях, 
        а не в эксклюзивности отдельных фрагментов информации.
      </p>
      <p className="text-slate-300">
        2.4. Сервис не заявляет и не гарантирует уникальность, исключительность или недоступность 
        отдельных элементов материалов вне Сервиса.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">3. Отказ от гарантий и ответственности</h3>
      <p className="text-slate-300 mb-2">3.1. Сервис предоставляется на условиях «AS IS» («как есть»).</p>
      <p className="text-slate-300 mb-2">3.2. Администрация не гарантирует:</p>
      <ul className="text-slate-300 space-y-2">
        <li>соответствие Сервиса ожиданиям Пользователя;</li>
        <li>достижение каких-либо финансовых, коммерческих, профессиональных или иных результатов;</li>
        <li>бесперебойную и безошибочную работу Сервиса.</li>
      </ul>
      <p className="text-slate-300 mb-2">3.3. Администрация не несёт ответственности за:</p>
      <ul className="text-slate-300 space-y-2">
        <li>любые прямые или косвенные убытки, включая упущенную выгоду;</li>
        <li>последствия применения Пользователем полученных материалов;</li>
        <li>действия или бездействие третьих лиц;</li>
        <li>временные технические сбои и ограничения доступа.</li>
      </ul>
      <p className="text-slate-300">
        3.4. Все решения о применении материалов, рекомендаций и услуг принимаются Пользователем 
        самостоятельно и на его риск.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">4. Законность использования</h3>
      <p className="text-slate-300 mb-2">
        4.1. Сервис не предназначен для поощрения, организации или содействия противоправной деятельности.
      </p>
      <p className="text-slate-300 mb-2">
        4.2. Пользователь обязуется использовать Сервис исключительно в рамках применимого 
        законодательства и правил третьих сторон.
      </p>
      <p className="text-slate-300">
        4.3. Ответственность за законность использования материалов и услуг Сервиса полностью 
        возлагается на Пользователя.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">5. Интеллектуальная собственность</h3>
      <p className="text-slate-300 mb-2">
        5.1. Все материалы, размещённые в Сервисе, охраняются законодательством об интеллектуальной 
        собственности.
      </p>
      <p className="text-slate-300 mb-2">
        5.2. Пользователю запрещается копировать, распространять, перепродавать, передавать третьим 
        лицам или иным образом использовать материалы Сервиса без разрешения правообладателя.
      </p>
      <p className="text-slate-300">
        5.3. Нарушение прав интеллектуальной собственности может повлечь ограничение доступа к 
        Сервису без компенсации.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">6. Ограничение доступа</h3>
      <p className="text-slate-300 mb-2">6.1. Администрация вправе приостановить или ограничить доступ Пользователя к Сервису в случае:</p>
      <ul className="text-slate-300 space-y-2">
        <li>нарушения условий настоящего Соглашения;</li>
        <li>выявления злоупотреблений;</li>
        <li>требований законодательства или платёжных провайдеров.</li>
      </ul>
      <p className="text-slate-300 mb-2">
        6.2. Ограничение доступа не освобождает Пользователя от обязательств, возникших ранее.
      </p>
      <p className="text-slate-300">
        6.3. Администрация оставляет за собой право отказывать в обслуживании Пользователям, чьи 
        действия могут создавать повышенные риски для Сервиса, платёжных провайдеров или третьих лиц.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">7. Платежи и возвраты</h3>
      <p className="text-slate-300 mb-2">
        7.1. Оплата услуг и цифровых товаров производится на условиях, указанных в Сервисе до момента оплаты.
      </p>
      <p className="text-slate-300 mb-2">
        7.2. В связи с нематериальным характером цифровых товаров и услуг, возврат денежных средств 
        после предоставления доступа не осуществляется, за исключением случаев, указанных ниже.
      </p>
      <p className="text-slate-300 mb-2">7.3. Возврат средств возможен только если:</p>
      <ul className="text-slate-300 space-y-2">
        <li>услуга не была оказана по технической вине Сервиса;</li>
        <li>доступ к цифровому товару фактически не был предоставлен.</li>
      </ul>
      <p className="text-slate-300 mb-2">
        7.4. Для рассмотрения вопроса о возврате Пользователь обязан обратиться в службу поддержки 
        в течение 24 часов с момента оплаты.
      </p>
      <p className="text-slate-300 mb-2">
        7.5. Решение о возврате принимается Администрацией индивидуально.
      </p>
      <p className="text-slate-300">
        7.6. Пользователь подтверждает, что обязуется не инициировать возврат платежа (chargeback) 
        через платёжные системы без предварительного обращения в службу поддержки Сервиса.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">8. Конфиденциальность</h3>
      <p className="text-slate-300 mb-2">
        8.1. Администрация может собирать минимально необходимые технические данные для обеспечения 
        работы Сервиса.
      </p>
      <p className="text-slate-300">
        8.2. Администрация принимает разумные меры для защиты данных, однако не гарантирует 
        абсолютную безопасность передаваемой информации.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">9. Изменение условий</h3>
      <p className="text-slate-300 mb-2">
        9.1. Администрация вправе вносить изменения в настоящее Соглашение.
      </p>
      <p className="text-slate-300 mb-2">
        9.2. Актуальная версия Соглашения публикуется в Сервисе.
      </p>
      <p className="text-slate-300">
        9.3. Продолжение использования Сервиса означает согласие Пользователя с обновлёнными условиями.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">10. Контактная информация</h3>
      <p className="text-slate-300 mb-4">
        10.1. По всем вопросам Пользователь может обратиться в службу поддержки через форму в самом боте.
      </p>
      
      <p className="text-slate-300 italic">
        Используя Сервис (в том числе запуская бота и/или вводя команду /start), Пользователь 
        подтверждает, что ознакомлен с настоящим Соглашением и принимает его условия в полном объёме.
      </p>
    </div>
  )
}

// Контакты поддержки
function SupportContacts() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Поддержка</h2>

      {/* Telegram */}
      <a
        href="https://t.me/maydavpn"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-slate-800 hover:bg-slate-700 rounded-xl p-6 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-lg">
            <MessageCircle className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Telegram</h3>
            <p className="text-slate-400 text-sm">@maydavpn</p>
            <p className="text-slate-500 text-xs mt-1">Ответ в течение 24 часов</p>
          </div>
        </div>
      </a>

      {/* Email */}
      <a
        href="mailto:support@maydavpn.com"
        className="block bg-slate-800 hover:bg-slate-700 rounded-xl p-6 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="bg-green-500/10 p-3 rounded-lg">
            <Mail className="w-6 h-6 text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Email</h3>
            <p className="text-slate-400 text-sm">support@maydavpn.com</p>
            <p className="text-slate-500 text-xs mt-1">Ответ в течение 48 часов</p>
          </div>
        </div>
      </a>

      {/* FAQ */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-4">Частые вопросы</h3>
        <div className="space-y-4">
          <details className="group">
            <summary className="cursor-pointer text-slate-300 hover:text-white transition-colors">
              Как подключиться к VPN?
            </summary>
            <p className="text-slate-400 text-sm mt-2 pl-4">
              Перейдите на страницу «Подключение», скопируйте ссылку и откройте 
              её в приложении Hiddify, V2RayNG или Streisand.
            </p>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-slate-300 hover:text-white transition-colors">
              Не работает подключение
            </summary>
            <p className="text-slate-400 text-sm mt-2 pl-4">
              Проверьте срок действия подписки, попробуйте переподключиться, 
              убедитесь что используете правильную ссылку.
            </p>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-slate-300 hover:text-white transition-colors">
              Как продлить подписку?
            </summary>
            <p className="text-slate-400 text-sm mt-2 pl-4">
              Перейдите на страницу «Тарифы», выберите нужный план и оплатите.
            </p>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-slate-300 hover:text-white transition-colors">
              Возврат средств
            </summary>
            <p className="text-slate-400 text-sm mt-2 pl-4">
              Возврат возможен в течение 7 дней с момента оплаты. Напишите на 
              support@maydavpn.com с указанием причины.
            </p>
          </details>
        </div>
      </div>

      {/* Время работы */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-300 text-sm">
          💡 Техническая поддержка работает 24/7. Среднее время ответа: 2-4 часа.
        </p>
      </div>
    </div>
  )
}
