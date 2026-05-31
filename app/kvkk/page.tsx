'use client';

import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';

export default function KvkkPage() {
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
      {/* Neo-Grid Subtle Background Light (Pink/Purple Accent) */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.05) 0%, transparent 70%)',
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
              e.currentTarget.style.color = '#ec4899';
              e.currentTarget.style.border = '1px solid rgba(236, 72, 153, 0.4)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(236, 72, 153, 0.15)';
              e.currentTarget.style.background = 'rgba(236, 72, 153, 0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            }}
            id="kvkk-back-btn"
          >
            {t('common.back_menu')}
          </button>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            color: '#ec4899',
            margin: 0,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textShadow: '0 0 24px rgba(236, 72, 153, 0.3)',
          }}
        >
          {isTr ? 'KVKK Açık Rıza Beyanı' : 'KVKK Explicit Consent'}
        </h1>

        {/* Glassmorphic Content Panel */}
        <div
          style={{
            background: 'rgba(10, 15, 26, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(236, 72, 153, 0.12)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 0 40px rgba(236, 72, 153, 0.03), 0 10px 40px rgba(0,0,0,0.5)',
            lineHeight: 1.7,
            fontSize: '14px',
            color: '#9ca3af',
          }}
        >
          {isTr ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Son Güncelleme: 22 Mayıs 2026</strong></p>
              <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, Syncron platformu üzerinde gerçekleştireceğiniz kayıt ve üyelik işlemleri kapsamında kişisel verilerinizin işlenmesi ve yurt dışına aktarılması konularında açık rızanız talep edilmektedir.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. Açık Rıza Kapsamında İşlenen Veriler</h2>
              <p>Hesap açarken veya Google hesabınızı bağladığınızda sisteme kaydettiğiniz e-posta adresiniz, belirlediğiniz kullanıcı adı (tag), oyun skorlarınız ve destek sistemi üzerinden oluşturduğunuz biletler, ilettiğiniz mesajlar ve admin yanıtları KVKK uyarınca kişisel veri niteliğindedir.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. Yurt Dışına Veri Aktarımı (Önemli)</h2>
              <p>Syncron, bulut veri tabanı ve destek bilet sistemi altyapısı olarak Google Firebase Firestore servislerini kullanmaktadır. Google sunucuları ve yedekleme sistemleri yurt dışında (başta AB ülkeleri ve ABD olmak üzere) konumlandırılmıştır. Bu doğrultuda, platforma kayıt olarak, bir destek talebi açarak ve verilerinizin bulut ortamında saklanmasına izin vererek, kişisel verilerinizin <strong>yurt dışına aktarılmasına açık rıza gösterdiğinizi</strong> kabul edersiniz.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. İşleme Amaçları ve Hukuki Sebepler</h2>
              <p>Kişisel verileriniz, platform üzerinde kimlik doğrulamanızın yapılması, oyun ilerlemenizin yedeklenmesi, liderlik tablolarında (skor tablosu) isminizin ve derecenizin yayınlanması, destek taleplerinizin yanıtlanması ve teknik yardım süreçlerinin yürütülmesi amaçlarıyla işlenmektedir. Bu rıza beyanı, kanunun aradığı &quot;açık rıza&quot; hukuki sebebine dayanmaktadır.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Açık Rızanın Geri Alınması</h2>
              <p>Dilediğiniz zaman açık rızanızı geri çekme ve kişisel verilerinizin ile destek geçmişinizin sistemlerimizden tamamen silinmesini talep etme hakkınız bulunmaktadır. Rızanızı geri çekmeniz durumunda, çevrimiçi ilerleme eşitleme ve destek özellikleri devre dışı kalacak, hesabınız kalıcı olarak silinecektir.</p>

              <p style={{ marginTop: '20px', color: '#e5e7eb', fontWeight: 600 }}>
                &quot;Hesap Oluştur&quot; veya &quot;Google ile Devam Et&quot; butonuna basarak kayıt olurken aktif kutucuğu işaretlemeniz halinde, yukarıdaki metni okuduğunuzu, verilerinizin yurt dışındaki Google sunucularına aktarılmasına, destek sisteminde işlenmesine ve skor tablolarında yayınlanmasına özgür iradenizle açık rıza verdiğinizi beyan etmiş olursunuz.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p><strong>Last Updated: May 22, 2026</strong></p>
              <p>In accordance with the Turkish Personal Data Protection Law No. 6698 (&quot;KVKK&quot;), we request your explicit consent regarding the processing and transfer of your personal data abroad when registering an account on Syncron.</p>
              
              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>1. Scope of Processed Data</h2>
              <p>Your email address, custom profile tag (username), calculated game scores, and support tickets with submitted messages and administrator replies recorded under your profile constitute personal data under KVKK protection guidelines.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>2. Abroad Data Transfer (Critical Consent)</h2>
              <p>Syncron operates using Google Cloud Firebase database and support ticket systems. Google servers and physical backup nodes are hosted in locations abroad (primarily European Union countries and the United States). By registering an account, submitting a support ticket, and enabling cloud progress saving, you declare your **explicit consent to the transfer of your personal data abroad**.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>3. Processing Purposes</h2>
              <p>Your records are processed strictly to authenticate your account session, secure your game status, back up solutions across browsers, render your ranking details on public high-score leaderboards, and respond to your technical assistance support tickets.</p>

              <h2 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>4. Revoking Your Consent</h2>
              <p>You reserve the right to withdraw your explicit consent at any time and request permanent deletion of your credentials and ticket history. Revoking this consent will automatically terminate your account session, wipe database backups and support history, and disable online cloud synchronization.</p>

              <p style={{ marginTop: '20px', color: '#e5e7eb', fontWeight: 600 }}>
                By checking the active consent checkbox during account creation or Google linking, you state that you have read and understood this document and willingly provide your explicit consent to the abroad transfer, support ticket processing, and leaderboard rendering of your data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
