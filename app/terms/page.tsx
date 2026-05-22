'use client';

import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';

export default function TermsPage() {
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
      {/* Neo-Grid Subtle Background Light */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0, 255, 136, 0.05) 0%, transparent 70%)',
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
              e.currentTarget.style.color = '#00ff88';
              e.currentTarget.style.border = '1px solid rgba(0, 255, 136, 0.4)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 136, 0.15)';
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            }}
            id="terms-back-btn"
          >
            {t('common.back_menu')}
          </button>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            color: '#00ff88',
            margin: 0,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textShadow: '0 0 24px rgba(0, 255, 136, 0.3)',
          }}
        >
          {isTr ? 'Kullanım Koşulları' : 'Terms of Service'}
        </h1>

        {/* Glassmorphic Content Panel */}
        <div
          style={{
            background: 'rgba(10, 15, 26, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 255, 136, 0.12)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 0 40px rgba(0, 255, 136, 0.03), 0 10px 40px rgba(0,0,0,0.5)',
            lineHeight: 1.7,
            fontSize: '14px',
            color: '#9ca3af',
          }}
        >
          {isTr ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Son Güncelleme: 22 Mayıs 2026</strong></p>
              <p>Syncron platformuna hoş geldiniz. Bu oyun, Polyvo Club tarafından geliştirilen ve yönetilen web ve mobil tabanlı bir bulmaca platformudur. Hizmetlerimizi kullanarak bu koşulları tamamen kabul etmiş sayılırsınız.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. Hesap Oluşturma ve Güvenlik</h2>
              <p>Oyun ilerlemenizi kaydetmek ve özel leveller tasarlamak için Google hesabınız veya e-posta adresinizle kayıt olabilirsiniz. Hesap bilgilerinizin gizliliğini korumak sizin sorumluluğunuzdadır. 13 yaşından küçük kullanıcıların platformu ebeveyn gözetiminde kullanması gerekmektedir.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. Kullanıcı Tarafından Üretilen İçerik</h2>
              <p>Level editörümüzü kullanarak tasarladığınız ve gönderdiğiniz bulmaca levelleri topluluk tarafından erişilebilir hale gelecektir. Gönderdiğiniz içeriklerin telif haklarını koruduğunuzu, ancak bu içerikleri Syncron platformunda süresiz, ücretsiz ve dünya genelinde yayınlama hakkını platformumuza verdiğinizi kabul edersiniz. Uygunsuz, hakaret içeren, saldırgan veya platformu manipüle etmeye çalışan içerikler önceden bildirilmeksizin adminler tarafından kaldırılabilir.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. Kurallar ve Davranış İlkeleri</h2>
              <p>Platformumuzu kullanırken aşağıdaki kurallara uymayı taahhüt edersiniz:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Hile yapmak, skor tablolarını manipüle etmek ve oyun mekaniklerini kötüye kullanmak yasaktır.</li>
                <li>Diğer kullanıcılara hakaret etmek veya taciz edici taglar (kullanıcı adları) seçmek yasaktır.</li>
                <li>Bulut sunucularımıza veya işleyişimize zarar verecek siber saldırılarda bulunmak yasaktır.</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Sorumluluk Sınırları</h2>
              <p>Syncron hizmetleri &quot;olduğu gibi&quot; sunulmaktadır. Hizmetin kesintisiz veya hatasız olacağını garanti etmiyoruz. Sunucu kesintileri veya teknik arızalar nedeniyle oyun verilerinin, skorlarının veya level tasarımlarının kaybından dolayı platformumuz sorumlu tutulamaz.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>5. Değişiklikler</h2>
              <p>Syncron, bu koşulları dilediği zaman güncelleme hakkını saklı tutar. Değişiklikler yapıldığında, kullanıcılarımızın onayını almak üzere bilgilendirme panelleri aktif hale getirilecektir.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Last Updated: May 22, 2026</strong></p>
              <p>Welcome to Syncron. This grid puzzle game is developed and managed by Polyvo Club. By accessing and playing our game, you agree to comply with and be bound by the following Terms of Service.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. Account Registration and Security</h2>
              <p>To save your progress and design custom levels, you can register via email or connect with your Google account. You are responsible for safeguarding your account details. Children under 13 must use our services under parent or guardian supervision.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. User Generated Content (Level Editor)</h2>
              <p>Bulding and submitting grid levels using our level editor allows other players to play your designs. You retain your ownership of such levels, but you grant Syncron an irrevocable, royalty-free, worldwide license to host, display, and distribute this content. Admin moderators reserve the right to remove any level request that is offensive, unplayable, or violates our community standards.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. Code of Conduct</h2>
              <p>When playing Syncron, you agree not to:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Exploit game mechanics or cheat to achieve fraudulent high scores on leaderboards.</li>
                <li>Harass other players or choose offensive tags (usernames).</li>
                <li>Engage in any cyberattacks or actions that disrupt our database and cloud functions.</li>
              </ul>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Disclaimer and Limitation of Liability</h2>
              <p>Syncron is provided &quot;as is&quot; without warranties of any kind. We do not guarantee continuous or error-free operations. We are not liable for any data loss, including level creations or scores, resulting from technical failures or scheduled server maintenance.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>5. Updates to Terms</h2>
              <p>We reserve the right to modify these terms at any time. When significant updates occur, we will present them to active users for explicit renewal of consent.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
