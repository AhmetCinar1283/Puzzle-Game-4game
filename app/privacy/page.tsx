'use client';

import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';

export default function PrivacyPage() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();

  const isTr = lang === 'tr';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      }}
    >
      {/* Neo-Grid Subtle Background Light (Cyan Accent) */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0, 196, 255, 0.05) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Back button */}
        <div>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9ca3af',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#00c4ff';
              e.currentTarget.style.border = '1px solid rgba(0, 196, 255, 0.4)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 196, 255, 0.15)';
              e.currentTarget.style.background = 'rgba(0, 196, 255, 0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            }}
            id="privacy-back-btn"
          >
            {t('common.back_menu')}
          </button>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            color: '#00c4ff',
            margin: 0,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textShadow: '0 0 24px rgba(0, 196, 255, 0.3)',
          }}
        >
          {isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
        </h1>

        {/* Glassmorphic Content Panel */}
        <div
          style={{
            background: 'rgba(10, 15, 26, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 196, 255, 0.12)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 0 40px rgba(0, 196, 255, 0.03), 0 10px 40px rgba(0,0,0,0.5)',
            lineHeight: 1.7,
            fontSize: '14px',
            color: '#9ca3af',
          }}
        >
          {isTr ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Son Güncelleme: 25 Mayıs 2026</strong></p>
              <p>Syncron, oyun severlere eğlenceli ve güvenli bir ortam sunmayı amaçlar. Bu Gizlilik Politikası, topladığımız bilgileri, bunları nasıl kullandığımızı ve gizliliğinizi korumak için aldığımız önlemleri açıklar.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. Hangi Verileri Topluyoruz?</h2>
              <p>Hizmet kalitemizi korumak amacıyla aşağıdaki verileri toplamaktayız:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Kimlik ve İletişim Bilgileri:</strong> Bir hesap oluşturduğunuzda veya Google hesabınızı bağladığınızda e-posta adresiniz, kullanıcı adınız ve profil resminiz.</li>
                <li><strong>Destek Talepleri ve İletişim Geçmişi:</strong> Destek sistemi üzerinden oluşturduğunuz biletler, ilettiğiniz mesajlar, ek notlar ve admin yanıt geçmişi.</li>
                <li><strong>Oyun İlerleyişi ve İstatistikleri:</strong> Çözdüğünüz bulmacalar, skorlarınız, hamle sayılarınız, harcadığınız süreler ve tasarladığınız özel leveller.</li>
                <li><strong>Teknik Veriler:</strong> Cihaz türünüz, işletim sisteminiz ve Google Analytics 4 (GA4) üzerinden toplanan anonim kullanım analitikleri.</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. Verileri Nasıl Kullanıyoruz?</h2>
              <p>Topladığımız verileri şu amaçlarla kullanırız:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Oyun ilerlemenizi cihazlar arasında eşitlemek.</li>
                <li>Liderlik tablolarını (Skor Tablosu) oluşturmak ve güncellemek.</li>
                <li>Hile tespit sistemlerimizi ve oyun doğrulama algoritmalarımızı çalıştırmak.</li>
                <li>Destek taleplerinizi yanıtlamak, hesap sorunlarınızı çözmek ve teknik yardım sunmak.</li>
                <li>Level editöründe oluşturduğunuz levelleri topluluğun beğenisine sunmak.</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. Verilerin Saklanması ve Güvenliği</h2>
              <p>Verileriniz, Google Firebase ve Firestore üzerinde yüksek güvenlikli sunucularda saklanmaktadır. Şifreniz gibi kritik kimlik doğrulama verileri platformumuz tarafından asla düz metin olarak görülmez veya kaydedilmez; tamamen Firebase Auth altyapısıyla şifrelenmiş olarak işlenir.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Veri Paylaşımı ve Üçüncü Taraflar</h2>
              <p>Syncron, kişisel verilerinizi üçüncü taraflara satmaz veya kiralamaz. Verileriniz yalnızca Firebase (veri tabanı ve kimlik doğrulama için) ve Google Analytics (anonim kullanım istatistikleri için) gibi güvenilir bulut servis sağlayıcılarımızla paylaşılır.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>5. Kullanıcı Hakları ve Veri Silme</h2>
              <p>Hesabınızı ve tüm ilerleme verilerinizi silme hakkına sahipsiniz. Verilerinizin kalıcı olarak silinmesini talep etmek için destek kanallarımızdan bizimle iletişime geçebilirsiniz.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Last Updated: May 25, 2026</strong></p>
              <p>At Syncron, we are committed to protecting the privacy of our players. This Privacy Policy details the types of information we collect, how we use it, and the security measures we deploy to safeguard your data.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. What Data We Collect</h2>
              <p>We process the following information to keep the game functional and engaging:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Account Credentials:</strong> Your email address, profile display name, and avatar when registering via Google Auth or email.</li>
                <li><strong>Support Tickets and Interaction Logs:</strong> Detailed tickets created via the support system, submitted messages, attachments, and administrator reply logs.</li>
                <li><strong>Gameplay and Performance:</strong> Ratios of solved levels, total score points, move sequences, solved timings, and level submissions created by you.</li>
                <li><strong>Device and Analytical Information:</strong> Browser type, operating system, and anonymous usage telemetry collected via Google Analytics 4 (GA4).</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. How We Use Your Data</h2>
              <p>We utilize the collected information to:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Sync your gameplay levels and solutions across different devices.</li>
                <li>Render public game leaderboards and assign score rankings.</li>
                <li>Validate level solutions on the backend to prevent leaderboard manipulation.</li>
                <li>Address and resolve your support tickets, manage account issues, and provide technical assistance.</li>
                <li>Associate your designed levels with your personal account and unique tag identifier.</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. Data Storage and Cyber Security</h2>
              <p>Your records are securely stored within Firebase Firestore cloud systems. We do not store or see raw account passwords. Everything is processed and securely hashed by Google Firebase Authentication services.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Data Sharing</h2>
              <p>Syncron does not sell or lease your personal information. We strictly limit data storage and sharing to reliable sub-processors like Google Cloud Firebase and Google Analytics in accordance with strict security standards.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>5. Your Rights and Data Erasure</h2>
              <p>You have full ownership of your records. If you wish to delete your sync user document and account history completely, please contact us through our official support channels.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
