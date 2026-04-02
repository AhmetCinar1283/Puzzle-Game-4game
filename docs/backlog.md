# Backlog / Yapılacaklar

## Auth

- [ ] **Google sign-in fix** — `linkWithGoogle()` akışında edge case'ler var; test edilip düzeltilmeli
- [ ] **Admin özellikleri test** — `/admin` sayfası ve `approveLevelRequest` flow'u production'da test edilmeli

## Firebase / Firestore

- [ ] **Anonim kullanıcı Firestore temizliği (Cloud Function)**
  - Firebase Auth, anonim hesapları 30 gün hareketsizlik sonrası siler
  - Firestore'daki `users/{uid}` dokümanı ve `playedLevels` alt koleksiyonu otomatik silinmiyor
  - Çözüm: `functions/src/index.ts` içinde `auth.user().onDelete()` trigger'ı
  - Adımlar:
    1. `firebase init functions` (TypeScript)
    2. `onUserDeleted` fonksiyonu yaz — `playedLevels` alt koleksiyonunu + `users/{uid}` sil
    3. `firebase deploy --only functions`
  - Öncelik: düşük (maliyet ihmal edilebilir; başka ihtiyaçla birlikte yapılabilir)

- [ ] **Firestore rules tam test** — `levelRequests` kuralları, level okuma/yazma, `isNotAnonymous()` kontrolü

## Analytics

- [ ] **Ek event'ler** — level restart, menu navigasyonu takibi gerekirse `analytics.ts`'e eklenmeli

## Community Levels

- [ ] **Kullanıcı kendi taleplerini görebilsin** — editör veya ayrı bir sayfa: kendi gönderdiği taleplerin durumunu (`pending/approved/rejected`) listeleme
- [ ] **Moderator onay** — şu an sadece `admin` onaylayabiliyor; `moderator` rolüne de onay izni verilebilir (`firestore.rules` güncellenmeli)
