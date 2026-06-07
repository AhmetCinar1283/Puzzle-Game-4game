# 🛡️ Granüler Ban Sistemi + Kullanıcı Bloklama Planı

## Genel Bakış

**2 ajan, sıralı:**
- **Agent 9A** → Backend: D1 migration + ban service + API endpoints + friends.ts'e block ekleme
- **Agent 9B** → Frontend: Admin panel ban UI + /friends sayfasına block butonu

---

## Mevcut Durumun Özeti

### Mevcut:
- `friendships.status = 'blocked'` D1'de var ama block endpoint'i **yok** — sadece delete var
- `adminApi.ts`'te ban/unban **yok** — salt okunur admin API
- Arkadaşlık isteği göndermek, `blocked` durumunu kontrol ediyor ✅

### Eksikler:
1. `user_bans` D1 tablosu — granüler, süreli ban sistemi
2. Admin: ban yayınlama/kaldırma/listeleme endpoint'leri
3. Worker: ban kontrolü (sosyal ban → arkadaş isteği engellemesi, tag ban → tag değişikliği engellemesi)
4. Kullanıcı: birini bloklama/blok kaldırma endpoint'leri

---

## Ban Tipleri

| Tip | Kod | Ne Engeller? |
|-----|-----|--------------|
| Platform Banı | `platform` | Worker'a her isteği engeller (game, friends, badges vb.) |
| Tag Banı | `tag` | Tag değişikliği endpoint'ini engeller + mevcut tag'i null'a çeker |
| Sosyal Ban | `social` | Arkadaşlık isteği göndermeyi engeller |
| Co-op Ban | `coop` | (Gelecekte co-op özelliği için ayrılmış — şimdi kontrol yok ama DB'de saklanır) |

**Platform ban** en ağır — worker middleware seviyesinde kontrol edilir.
**Diğerleri** — ilgili route'larda kontrol edilir.

---

## Agent 9A — Backend (Ban Sistemi)

### Oku:
1. `syncron-worker/migrations/0002_leaderboard.sql` (mevcut şema — aynı DB'ye ekleyeceğiz)
2. `syncron-worker/src/routes/adminApi.ts` (mevcut admin API — aynı pattern)
3. `syncron-worker/src/middleware/adminAuth.ts` (admin auth)
4. `syncron-worker/src/services/firestore.ts` (fsPatch helper — tag null yapmak için)
5. `syncron-worker/src/services/auditLog.ts` (audit log yazma — aynı pattern kullan)
6. `syncron-worker/src/routes/friends.ts` (block endpoint eklenecek)
7. `syncron-worker/src/routes/game.ts` (platform ban kontrolü eklenecek)
8. `syncron-worker/src/middleware/auth.ts` (mevcut auth middleware)
9. `syncron-worker/src/index.ts` (route kaydı)
10. `syncron-worker/wrangler.jsonc` (binding adı: AUDIT_DB)

### 1. Yeni D1 Migration: `0003_bans.sql`

```sql
-- ─── user_bans ────────────────────────────────────────────────────────────────
-- Granular, time-limited ban records issued by admins.
-- ban_type : 'platform' | 'tag' | 'social' | 'coop'
-- expires_at: NULL = permanent ban
-- lifted_at : NULL = still active
--
-- Security notes:
--   • ban_type enum constraint prevents arbitrary types.
--   • reason: 1–500 chars.
--   • A user can have multiple active bans of different types simultaneously.
--   • "Is banned?" query: WHERE uid=? AND ban_type=? AND lifted_at IS NULL
--       AND (expires_at IS NULL OR expires_at > current_time)
CREATE TABLE IF NOT EXISTS user_bans (
  id          TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  uid         TEXT NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  ban_type    TEXT NOT NULL CHECK (ban_type IN ('platform', 'tag', 'social', 'coop')),
  reason      TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  issued_by   TEXT NOT NULL CHECK (length(issued_by) BETWEEN 1 AND 128),
  issued_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT,     -- ISO 8601 UTC, NULL = permanent
  lifted_at   TEXT,     -- set when lifted by admin
  lifted_by   TEXT,     -- admin uid who lifted the ban
  CHECK (expires_at IS NULL OR length(expires_at) BETWEEN 10 AND 30),
  CHECK (lifted_at IS NULL OR length(lifted_at) BETWEEN 10 AND 30)
);

-- Fast "is this user banned?" lookup
CREATE INDEX IF NOT EXISTS idx_bans_uid_type
  ON user_bans(uid, ban_type, lifted_at, expires_at);
```

**Dosya:** `syncron-worker/migrations/0003_bans.sql`

### 2. Ban Service: `syncron-worker/src/services/banService.ts`

```typescript
// checkActiveBan(db, uid, banType): boolean
// - WHERE uid=? AND ban_type=? AND lifted_at IS NULL
//   AND (expires_at IS NULL OR expires_at > datetime('now'))
// Returns true if an active ban exists.

// getActiveBans(db, uid): ActiveBan[]
// - Returns all active bans for a user (all types)

// getBanHistory(db, uid): BanRecord[]
// - Returns all bans (active + lifted + expired)
```

Bu servis 3 fonksiyon içerecek. Basit, tek amaçlı.

### 3. Admin Ban Endpoint'leri — `adminApi.ts`'e ekle

**`POST /admin/users/:uid/bans`** — Yeni ban yayınla
```typescript
// Body: { banType: 'platform'|'tag'|'social'|'coop', reason: string, expiresAt?: string }
// Validation (Zod):
//   banType: enum
//   reason: min 1, max 500
//   expiresAt: optional ISO 8601 datetime, gelecekte olmalı
// 
// 1. user_bans tablosuna INSERT
// 2. Eğer banType === 'tag': Firestore users/{uid} → { tag: null } + D1 user_profiles tag = null
// 3. auditLog: category='admin', action='admin.ban', metadata: { banType, reason, expiresAt, issuedBy }
//
// Sadece 'admin' rolü yapabilir:
//   if (c.get('role') !== 'admin') return 403
```

**`POST /admin/users/:uid/bans/:banId/lift`** — Tek bir ban'ı kaldır
```typescript
// 1. user_bans: UPDATE SET lifted_at=now, lifted_by=adminUid WHERE id=banId AND uid=uid
// 2. Eğer kayıt yoksa veya zaten kaldırılmışsa 404 dön
// 3. auditLog: action='admin.ban_lift', metadata: { banId, banType, liftedBy }
```

**`GET /admin/users/:uid/bans`** — Tüm ban geçmişi
```typescript
// SELECT * FROM user_bans WHERE uid=? ORDER BY issued_at DESC
// Response: { success: true, bans: BanRecord[], activeBans: ActiveBan[] }
// activeBans: lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now)
```

### 4. Platform Ban Middleware — `auth.ts`'e helper ekle

`firebaseAuth` middleware'ine platform ban kontrolü **ekleme** — çünkü bu middleware zaten her yerde kullanılıyor ve ban kontrolü için DB sorgusu yapmak performansı etkiler. Bunun yerine:

- Sadece `game.ts`'deki `complete-level` handler'ında platform ban kontrol et (en kritik endpoint)
- Diğer endpoint'ler için ban kontrolü yoktur şimdilik — çok küçük adımlar atalım

Bu bir trade-off — platform ban olan kullanıcı leaderboard'u okuyabilir, rozetlerini görebilir ama oyun oynayamaz. İleride genişletilebilir.

Implementasyon: `game.ts`'deki complete-level handler'ının başına:
```typescript
const isBanned = await checkActiveBan(c.env.AUDIT_DB, uid, 'platform');
if (isBanned) return c.json({ success: false, error: 'Account suspended' }, 403);
```

**Sosyal ban:** `friends.ts`'deki `POST /friends/request` handler'ında:
```typescript
const isSocialBanned = await checkActiveBan(c.env.AUDIT_DB, uid, 'social');
if (isSocialBanned) return c.json({ success: false, error: 'Social features are restricted' }, 403);
```

**Tag ban:** Tag değişikliği hangi endpoint'te yapılıyorsa orada kontrol edilmeli. Şu an bu endpoint gözükmüyor — agent araştırıp bulacak. Eğer yoksa not at.

### 5. Kullanıcı-Kullanıcı Bloklama — `friends.ts`'e ekle

**`POST /friends/block/:uid`** — Birini engelle
```typescript
// firebaseAuth zorunlu
// 1. Canonical ordering: getCanonicalKeys(uid, targetUid)
// 2. Mevcut ilişkiyi kontrol et
// 3. Eğer accepted/pending → UPDATE SET status='blocked', updated_at=now, requested_by (blocked_by olarak kullan)
//    Eğer yoksa → INSERT (user_a, user_b, status='blocked', requested_by=uid)
//    Eğer zaten blocked → 409 "Already blocked"
// 4. { success: true }
//
// NOT: 'requested_by' field'ı bu durumda "blocked_by" anlamında kullanılıyor
// Bu mimari tutarlı — kanonik çift her zaman tek satırda
```

**`DELETE /friends/block/:uid`** — Engeli kaldır (unblock)
```typescript
// firebaseAuth zorunlu
// Canonical ordering
// blocked_by === uid (sadece bloklayan kaldırabilir)
// UPDATE SET status='pending' değil → sadece DELETE (ilişkiyi tamamen sil)
// { success: true }
```

**`GET /friends/blocked`** — Engellediğin kullanıcılar listesi
```typescript
// SELECT ... FROM friendships WHERE (user_a=uid OR user_b=uid) AND status='blocked' AND requested_by=uid
// Response: { success: true, blocked: [{ uid, displayName, tag }] }
```

### Çıktı Dosyaları:
- `syncron-worker/migrations/0003_bans.sql` (yeni)
- `syncron-worker/src/services/banService.ts` (yeni)
- `syncron-worker/src/routes/adminApi.ts` (değişiklik — 3 endpoint)
- `syncron-worker/src/routes/game.ts` (değişiklik — platform ban kontrolü)
- `syncron-worker/src/routes/friends.ts` (değişiklik — 3 block endpoint + social ban)

### Rapor: `.agents/plans/plan1/agent9a-rapor.md`

---

## Agent 9B — Frontend (Admin Ban UI + Kullanıcı Block UI)

### Bağımlılık: Agent 9A tamamlanmış olmalı.

### Oku:
1. `app/admin/users/detail/AdminUserProfileClient.tsx` (1072 satır — tam oku)
2. `.agents/plans/plan1/agent9a-rapor.md` (hangi endpoint'ler eklendi)
3. `app/src/lib/api/adminClient.ts` (fetchAdminApi pattern)
4. `app/friends/FriendsClient.tsx` (mevcut arkadaş UI — block butonu eklenecek)
5. `app/src/lib/api/workerClient.ts` (workerFetch)

### Admin Panel Değişiklikleri — `AdminUserProfileClient.tsx`

**Bölüm 1 — Aktif Ban Banner (profil kartı üstüne):**
```
[KIRMIZI] 🚫 Bu hesap kısıtlıdır:
  Platform Banı — 7 gün kaldı — "Kural ihlali"
  Tag Banı — Kalıcı — "Uygunsuz kullanıcı adı"
  [Banları Yönet ↓]
```
- `GET /admin/users/:uid/bans` çağrısı
- Aktif ban yoksa banner gösterilmez
- Banner tipine göre renk: platform=kırmızı, tag=turuncu, social=sarı, coop=mor

**Bölüm 2 — Ban Yönetimi Bölümü (mevcut Grid 2 ve Grid 3 arasına):**

```
┌─────────────────────────────────────────────────────┐
│  🚫 BAN / KISITLAMA YÖNETİMİ        [+ YENİ BAN]  │
├─────────────────────────────────────────────────────┤
│  Aktif Kısıtlamalar:                                │
│  ● Platform — 7 gün kaldı — Kural ihlali [Kaldır]  │
│  ● Tag — Kalıcı — Uygunsuz tag         [Kaldır]    │
│                                                     │
│  Ban Geçmişi (Kaldırılmış/Süresi Dolmuş):           │
│  ○ Social — 12 Haz 2026 — Süresi doldu            │
└─────────────────────────────────────────────────────┘
```

**Yeni Ban Modalı:**
```
Ban Tipi:  [○ Platform] [○ Tag] [○ Sosyal] [○ Co-op]
Süre:      [○ Kalıcı] [○ Süreli] → [tarih seçici]
Neden:     [_________________________________]
            (max 500 karakter sayacı)
           [İptal]  [BAN UYGULA]
```

- Ban tipi seçilince altında ne engellediği açıklaması gösterilsin
- `expiresAt` için datetime-local input (min: şimdiki zaman)
- Confirm: "Bu işlem geri alınabilir. Devam?" → [Evet, Uygula]

**Ban kaldırma:**
- Her aktif ban satırında [Kaldır] butonu
- Küçük confirm: "Bu ban kaydını kaldırmak istediğinizden emin misiniz?"

### Arkadaş Sayfası Değişiklikleri — `FriendsClient.tsx`

**Arkadaş listesindeki her karta** → `...` veya ⋮ menüsü:
- Arkadaşlıktan Çıkar (mevcut)
- **Bu Kişiyi Engelle** (yeni) → `POST /friends/block/:uid`

**Yeni "Engellenenler" alt bölümü** (arkadaş listesinin altında, collapsible):
```
👁 Engellenen Kullanıcılar (2)
  ○ Oyuncu#TAG → [Engeli Kaldır]
```
- `GET /friends/blocked` endpoint'i

**Arama sonuçlarında:**
- Eğer o kullanıcı seni engellemiş ya da sen onu engellemişsen → arama sonuçlarında zaten görünmez (backend bunu hallediyor)
- Eğer arkadaşsan → kart üzerinde engelle seçeneği

### Çıktı Dosyaları:
- `app/admin/users/detail/AdminUserProfileClient.tsx` (değişiklik)
- `app/friends/FriendsClient.tsx` (değişiklik — block/unblock + blocked list)
- `app/src/lib/api/adminClient.ts` (değişiklik — ban API fonksiyonları)
- `app/src/lib/api/friendsClient.ts` (değişiklik — block/unblock/blocked fonksiyonları)

### Rapor: `.agents/plans/plan1/agent9b-rapor.md`

---

## Ajanlara Söylenecek Şablon

### Agent 9A:
```
Sen granüler ban sistemi backend'inden sorumlusun.

Önce şu dosyaları oku:
1. .agents/plans/plan1/ban-plan.md (bu dosya — tam oku)
2. syncron-worker/migrations/0002_leaderboard.sql
3. syncron-worker/src/routes/adminApi.ts
4. syncron-worker/src/middleware/adminAuth.ts
5. syncron-worker/src/services/auditLog.ts
6. syncron-worker/src/routes/friends.ts
7. syncron-worker/src/routes/game.ts
8. syncron-worker/src/services/firestore.ts

Adım 1: Planını yaz (ban-plan.md'ye uygun, ne eksik ne fazla).
Adım 2: Kodla.
Adım 3: Güvenlik denetimi:
  - Ban endpoint'leri sadece 'admin' rolü kullanabilmeli
  - expiresAt gelecekte olmalı
  - Parameterized SQL zorunlu
  - Block: canonical ordering
  
Rapor: .agents/plans/plan1/agent9a-rapor.md
```

### Agent 9B:
```
Sen ban sistemi frontend'inden sorumlusun (Admin panel + arkadaş sayfası).

Önce şu dosyaları oku:
1. .agents/plans/plan1/ban-plan.md (bu dosya — tam oku)
2. .agents/plans/plan1/agent9a-rapor.md (hangi API endpoint'leri hazır)
3. app/admin/users/detail/AdminUserProfileClient.tsx (tam oku — 1072 satır)
4. app/friends/FriendsClient.tsx
5. app/src/lib/api/adminClient.ts
6. app/src/lib/api/friendsClient.ts
7. app/src/lib/api/workerClient.ts

Adım 1: Planla. Mevcut dosyaları iyi anla, bozma.
Adım 2: Kodla.
Adım 3: UX kontrolü — modal'lar anlaşılır mı? Loading/error state var mı?

Rapor: .agents/plans/plan1/agent9b-rapor.md
```

---

## Özet Tablo

| # | Ne? | Dosya | Ajan |
|---|-----|-------|------|
| 1 | D1 migration: user_bans tablosu | 0003_bans.sql | 9A |
| 2 | Ban service (checkActiveBan, getActiveBans, getBanHistory) | banService.ts | 9A |
| 3 | Admin: ban yayınla/kaldır/listele | adminApi.ts | 9A |
| 4 | Platform ban kontrolü (game.ts) | game.ts | 9A |
| 5 | Sosyal ban kontrolü (friends.ts) | friends.ts | 9A |
| 6 | Kullanıcı: block/unblock/listele | friends.ts | 9A |
| 7 | Admin panel: ban bölümü + modal | AdminUserProfileClient.tsx | 9B |
| 8 | Arkadaş sayfası: block butonu + engellenenler | FriendsClient.tsx | 9B |
