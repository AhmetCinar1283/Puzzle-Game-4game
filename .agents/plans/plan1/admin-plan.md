# 🛡️ Admin Panel Genişletme Planı

## Hedef
Yeni eklenen sistemlerin (leaderboard, rozetler, arkadaşlar, kullanıcı engelleme) admin panelinde **görüntülenebilir ve kontrol edilebilir** olması.

**Kapsam:** Tek bir ajan, tek bir oturum. Küçük ve odaklı.

---

## Mevcut Durum Özeti

### Backend (Worker) — Mevcut Admin API
| Endpoint | Durum |
|----------|-------|
| `GET /admin/users` | ✅ Mevcut |
| `GET /admin/users/:uid` | ✅ Mevcut |
| `GET /admin/users/:uid/logs` | ✅ Mevcut |
| `GET /admin/users/:uid/stats` | ✅ Mevcut |
| `GET /admin/users/:uid/played-levels` | ✅ Mevcut |

### Frontend — Mevcut Admin Sayfası
`app/admin/users/detail/AdminUserProfileClient.tsx` — Profil, istatistik, audit log, oynanan seviyeler.

### Eksik Olan (Yeni sistemler görünür değil)
- Kullanıcının leaderboard skoru
- Kullanıcının rozetleri
- Kullanıcının arkadaş listesi
- Kullanıcı engelleme/ban
- **Kullanıcı-kullanıcı engelleme** (kendi arasındaki block sistemi, `/friends` block feature)

---

## Kapsam — Ne Yapılacak?

### 1. Backend: 4 yeni admin endpoint (adminApi.ts)

| Endpoint | Ne Döner? |
|----------|-----------|
| `GET /admin/users/:uid/leaderboard-scores` | D1'den user_period_scores + user_world_records + creator_scores |
| `GET /admin/users/:uid/badges` | D1'den kullanıcının tüm rozetleri |
| `GET /admin/users/:uid/friends` | D1'den arkadaş listesi + pending istekler |
| `POST /admin/users/:uid/ban` | Firestore'da `banned: true, bannedAt, bannedReason` yaz + audit log |
| `POST /admin/users/:uid/unban` | Firestore'da banned kaldır + audit log |

**Not:** Engelleme yalnızca admin/moderatörün bir kullanıcıyı banning yapması (platform ban). Kullanıcı-kullanıcı block ise (`friendships.status = 'blocked'`) ayrı bir feature — bunu da görüntüleyebiliriz ama yönetmeyiz.

### 2. Frontend: AdminUserProfileClient.tsx'e 3 yeni bölüm ekle

**Yeni bölüm 1 — Leaderboard Skorları:**
- Kullanıcının haftalık/genel yıldız, level, rekor ve yaratıcı puanlarını göster
- Basit istatistik kartları (sayısal, minimal)

**Yeni bölüm 2 — Rozetler:**
- Kullanıcının kazandığı tüm rozetlerin listesi (badge_type, period_id, awarded_at)
- Hangi rozeti vitrine koyduğu (showcaseBadges — Firestore'daki profil'den geliyor)

**Yeni bölüm 3 — Arkadaşlar:**
- Kabul edilmiş arkadaş sayısı + listesi (uid, displayName, tag)
- Bekleyen gönderilen/gelen istek sayısı
- Engelleme durumu (blocked status)

**Yeni bölüm 4 — Admin Aksiyonlar (Ban/Unban):**
- Kullanıcı profil kartının sağ üst köşesine ⛔ BAN / ✅ UNBAN butonu
- Ban nedeni yazma alanı (text input)
- Onay modalı
- Banned kullanıcı profilinde kırmızı uyarı banner'ı

---

## Tek Ajana Görev Dağılımı

**Tümü tek bir ajan (Agent 9) yapacak.** Değişiklik sayısı az ama etki büyük.

### Oku:
1. `.agents/plans/plan1/admin-plan.md` (bu dosya)
2. `syncron-worker/src/routes/adminApi.ts` (mevcut admin API pattern'ı)
3. `syncron-worker/src/middleware/adminAuth.ts` (admin auth middleware)
4. `syncron-worker/src/services/firestore.ts` (Firestore helper'ları)
5. `syncron-worker/migrations/0002_leaderboard.sql` (D1 tablo şemaları)
6. `app/admin/users/detail/AdminUserProfileClient.tsx` (mevcut UI — 1072 satır, dikkatli oku)
7. `app/src/lib/api/adminClient.ts` (fetchAdminApi)
8. `syncron-worker/src/services/auditLog.ts` (audit log yazma deseni)

### Backend Görevleri — `syncron-worker/src/routes/adminApi.ts`

**Endpoint 1: `GET /admin/users/:uid/leaderboard-scores`**
```typescript
// D1 sorguları — AUDIT_DB binding
// user_period_scores: all_time + son haftalık dönem
// user_world_records: all_time
// creator_scores: all_time
// Response:
{
  success: true,
  scores: {
    starsAllTime: number,
    starsWeekly: number,       // son hafta
    levelsAllTime: number,
    levelsWeekly: number,
    worldRecords: number,      // all_time aktif rekor sayısı
    creatorPlays: number,      // all_time
    creatorStars: number       // all_time
  }
}
```

**Endpoint 2: `GET /admin/users/:uid/badges`**
```typescript
// SELECT * FROM badges WHERE uid = ? ORDER BY awarded_at DESC
// Response: { success: true, badges: Badge[], showcaseBadges: string[] }
// showcaseBadges: Firestore user doc'taki showcaseBadges array'i
```

**Endpoint 3: `GET /admin/users/:uid/friends`**
```typescript
// SELECT user_a, user_b, status, requested_by FROM friendships
// WHERE (user_a = ? OR user_b = ?)
// JOIN user_profiles on the other user's uid
// Response:
{
  success: true,
  accepted: Friend[],
  pendingIncoming: Friend[],
  pendingSent: Friend[],
  blocked: Friend[]
}
```

**Endpoint 4: `POST /admin/users/:uid/ban`**
```typescript
// Body: { reason: string }
// 1. Firestore: users/{uid} → { banned: true, bannedAt: ISO, bannedReason: reason, bannedBy: adminUid }
// 2. auditLog: category='admin', action='admin.ban', metadata: { reason, bannedBy }
// Sadece 'admin' rolü yapabilir (moderator yapamaz)
```

**Endpoint 5: `POST /admin/users/:uid/unban`**
```typescript
// 1. Firestore: users/{uid} → { banned: false, bannedAt: null, bannedReason: null }
// 2. auditLog: category='admin', action='admin.unban', metadata: { unbannedBy: adminUid }
```

**Güvenlik notu:**
- Ban/unban endpoint'leri `adminAuth` middleware ile korunuyor (zaten)
- Ban sadece `role === 'admin'` yapabilsin, moderatör yapmasın:
  `if (c.get('role') !== 'admin') return c.json({ error: 'Forbidden' }, 403)`
- `reason` alanı max 500 karakter ile sınırla (Zod validation)

### Frontend Görevleri — `AdminUserProfileClient.tsx`

**Profil kartına ban durumu göstergesi ekle:**
- `profile.banned === true` ise profil bölümünün üstüne kırmızı banner: `🚫 Bu kullanıcı yasaklandı — [tarih] — Neden: [reason]`
- Sağ üst köşeye BAN/UNBAN butonu

**Ban Modal:**
- Confirm dialog
- Neden input (textarea, max 500 karakter)
- Confirm buton kırmızı, cancel gri

**Yeni section — "Leaderboard Skoru":**
- Profil kartının hemen altına ekle
- Küçük istatistik kartları: Toplam Yıldız | Haftalık Yıldız | Toplam Level | Dünya Rekoru | Yaratıcı Puanı
- `GET /admin/users/:uid/leaderboard-scores` endpoint'ini çek

**Yeni section — "Rozetler":**
- `GET /admin/users/:uid/badges` endpoint'ini çek
- Rozet listesi: badge_type, period_id, awarded_at
- Hangileri vitrine konulmuş (showcaseBadges) — yeşil işaret ile göster

**Yeni section — "Arkadaşlar":**
- `GET /admin/users/:uid/friends` endpoint'ini çek
- 4 sayaç: Arkadaş | Gelen İstek | Gönderilen | Engellenen
- Listelerde sadece displayName ve tag göster (uid de gizli)

**Önemli:** `AdminUserProfileClient.tsx` 1072 satırlık bir dosya. Mevcut bölümleri bozma. Yeni bölümleri mevcut "Grid 2: Statistics" ile "Grid 3: Audit Log" arasına ekle.

### Çıktı Dosyaları
- `syncron-worker/src/routes/adminApi.ts` (değişiklik — 5 yeni endpoint)
- `app/admin/users/detail/AdminUserProfileClient.tsx` (değişiklik — 4 yeni bölüm + ban UI)

### Rapor
`.agents/plans/plan1/agent9-rapor.md`

---

## 🔑 Ajana Söylenecek Şablon

```
Sen Admin Panel genişletme görevinden sorumlusun (Agent 9).

Önce şu dosyaları oku:
1. .agents/plans/plan1/admin-plan.md (görev tanımı — tam oku)
2. syncron-worker/src/routes/adminApi.ts (mevcut admin API — pattern'ı anla)
3. syncron-worker/src/middleware/adminAuth.ts
4. syncron-worker/src/services/firestore.ts
5. syncron-worker/migrations/0002_leaderboard.sql (D1 tablo şemaları)
6. app/admin/users/detail/AdminUserProfileClient.tsx (mevcut UI — tam oku)
7. app/src/lib/api/adminClient.ts
8. syncron-worker/src/services/auditLog.ts

Adım 1: admin-plan.md'yi okuduktan sonra nasıl kodlayacağını planla.
Mevcut kodun yapısını boz, fazla ya da eksik bir şey ekleme.

Adım 2: Kodla.

Adım 3: Güvenlik denetimi:
- Ban endpoint'leri sadece admin rolü kullanabilmeli
- D1 sorguları parameterized olmalı
- Ban reason max 500 karakter validation

Rapor: .agents/plans/plan1/agent9-rapor.md
```
