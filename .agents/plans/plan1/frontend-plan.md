# 🎨 Frontend Ajan Planı — Lider Tabloları, Rozetler ve Arkadaşlar

## Proje Hakkında Bilgi

- **Framework**: Next.js (App Router) + Tailwind CSS v4
- **State**: Redux Toolkit (`userSlice.ts`)
- **Auth**: `useAuthContext()` hook — `user`, `isAnonymous`, `role`
- **API Client**: `app/src/lib/api/adminClient.ts` → `fetchAdminApi(path, options)` — auth token'ı otomatik ekler
- **Tema**: Neon dark theme (`#030712` bg, neon yeşil `#00ff88`, neon mavi `#00c4ff`)
  - `neon-text-green`, `neon-text-blue`, `neon-text-yellow`, `neon-text-purple` CSS class'ları mevcut
  - Font: Geist
- **Düzey**: Varolan sayfaların stiline bak (önce `app/page.tsx` ve `app/src/components/` incele)

## Genel Kurallar Tüm Frontend Ajanları İçin

1. **API Client'ı genişlet:** Leaderboard/friends/badges için yeni bir `app/src/lib/api/workerClient.ts` dosyası oluştur. Anonim çağrılar da desteklensin (token yoksa header ekleme).
2. **Server URL'i**: `process.env.NEXT_PUBLIC_WORKER_URL` — env var'dan oku.
3. **Loading/Error state**: Her veri çekme işleminde loading skeleton ve hata mesajı göster.
4. **Responsive**: Mobil önce (mobile-first) düşün. Oyun bir mobil app olarak da çalışıyor.
5. **Animasyonlar**: Tailwind `transition`, `duration-*`, `ease-*` class'ları kullan. Keyframe animasyon gerekiyorsa `globals.css`'e ekle.
6. **TypeScript**: Tüm API response'ları için TypeScript interface yaz.

---

## 🔑 Ortak API Client — Tüm Ajanlar İçin Referans

**Oluşturulacak dosya:** `app/src/lib/api/workerClient.ts`

Bu dosyayı **Agent 6** oluşturacak. Sonraki ajanlar bu client'ı kullanacak.

```typescript
// app/src/lib/api/workerClient.ts
// Leaderboard, friends, badges gibi hem anonim hem authenticated endpoint'ler için.
// Auth gerektiren endpoint'ler token yoksa throw eder.
// Auth gerektirmeyen endpoint'ler token varsa gönderir, yoksa onsuz devam eder.

export async function workerFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; requireAuth?: boolean }
): Promise<T>
```

---

## 📋 Frontend Ajan Dağılımı

| Ajan | Sayfalar / Bileşenler | Bağımlılık |
|------|-----------------------|------------|
| **Agent 6** | API client (`workerClient.ts`) + Leaderboard sayfası (`/leaderboard`) | — |
| **Agent 7** | Rozet sistemi: `GET /badges/:uid` + profil rozet vitrini + rozet seçim UI'ı | Agent 6 (client) |
| **Agent 8** | Arkadaş sistemi: arama, istek gönderme, liste + arkadaş leaderboard sekmesi | Agent 6 (client) |

---

## Agent 6 — API Client + Leaderboard Sayfası

### Görev Özeti
- `workerClient.ts` oluştur
- `/leaderboard` sayfası yaz
- Leaderboard verisini çeken hook yaz

### Oluşturulacak Dosyalar

```
app/src/lib/api/workerClient.ts           (yeni — tüm worker API çağrıları)
app/src/lib/api/leaderboardClient.ts      (yeni — leaderboard-specific helpers)
app/leaderboard/page.tsx                  (yeni — leaderboard sayfası)
app/leaderboard/loading.tsx               (yeni — Next.js loading UI)
app/src/hooks/useLeaderboard.ts           (yeni — veri çekme hook)
```

### `workerClient.ts` Detayı

```typescript
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

export async function workerFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    requireAuth?: boolean;  // default: false
  } = {}
): Promise<T>
```

- `requireAuth: true` ise `auth.currentUser.getIdToken()` çek, header'a ekle. Token yoksa throw.
- `requireAuth: false` (varsayılan) ise token varsa ekle, yoksa header olmadan gönder.

### Leaderboard Sayfası UI

**URL:** `/leaderboard`

**Sayfa Yapısı (yukarıdan aşağıya):**

1. **Başlık** — "LIDER TABLOSU" neon title
2. **Kategori Sekmeleri** (4 adet):
   - ⭐ Yıldız Avcıları
   - 🏔 Bölüm Fatihleri
   - 🏅 Rekortmenler
   - 🏗 Usta Mimarlar
3. **Dönem Sekmeleri** (her kategoriye göre değişir):
   - Yıldız/Bölüm/Rekor: Günlük | Haftalık | Genel
   - Mimar: Aylık | Genel
4. **Podyum** (ilk 3 oyuncu için büyük, animasyonlu görsel)
5. **Sıralama Listesi** (4–50 arası)
6. **"Senin Yerin"** bölümü — giriş yapmış kullanıcının kendi sırası + ±2 etrafındaki oyuncular
7. **Arkadaş Sekmesi** — (Agent 8 ekleyecek) şimdilik sadece yer tutucu

**API Çağrısı:**
```
GET /leaderboard/:category/:period?limit=50&around_me=true
```
- `category`: `stars` | `levels` | `records` | `creators`
- `period`: `daily` | `weekly` | `all_time` | `monthly`

**TypeScript Interface:**
```typescript
export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string | null;
  tag: string | null;
  value: number;
}

export interface LeaderboardResponse {
  success: boolean;
  category: string;
  period: string;
  periodId: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myValue: number | null;
  totalPlayers: number;
}
```

**Podyum Tasarımı:**
- 1. sıra: Ortada, en büyük, neon altın (`#ffd700`) glow
- 2. sıra: Solda, gümüş glow
- 3. sıra: Sağda, bronz glow
- Küçük animasyon: entry sırasında yukarı slide-in

**Sıralama Satırı:**
- Sıra numarası | Kullanıcı adı (tag varsa `[TAG]` ile) | Değer (yıldız/seviye/rekor sayısı)
- Kendi satırı highlight edilmiş (neon green border)
- Rozet ikonları (Agent 7 ekleyecek — şimdilik sadece yer tutucu)

**"Senin Yerin" Bölümü:**
- Kullanıcı giriş yapmamışsa: "Sıralamada yer almak için giriş yap" mesajı
- Kullanıcı listede yoksa: "Bu dönemde henüz puan kazanmadın"
- Varsa: sıra numarası + etrafındaki oyuncular (faded satırlar)

### useLeaderboard Hook

```typescript
function useLeaderboard(
  category: 'stars' | 'levels' | 'records' | 'creators',
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
): {
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

- Kategori veya dönem değişince otomatik refetch.
- Cache: Simple in-memory cache, 2 dakika.

### SEO & Metadata

```typescript
export const metadata: Metadata = {
  title: 'Lider Tablosu',
  description: 'Syncron bulmaca oyununda en iyi oyuncuları görün...',
};
```

### Rapor: `.agents/plans/plan1/agent6-rapor.md`

---

## Agent 7 — Rozet Sistemi

### Görev Özeti
- `GET /badges/:uid` endpoint'inden rozet listesini çek
- Profil sayfasında rozet vitrini göster
- Kullanıcının kendi rozetlerini seçip sergileyeceği UI yaz
- Leaderboard'daki kullanıcı satırına sergilenen rozetleri göster

### Bağımlılık
- `app/src/lib/api/workerClient.ts` (Agent 6 yazdı) — kullan

### Oluşturulacak/Değiştirilecek Dosyalar

```
app/src/lib/api/badgesClient.ts         (yeni)
app/src/hooks/useBadges.ts              (yeni)
app/src/components/BadgeIcon.tsx        (yeni — tek rozet ikonu)
app/src/components/BadgeShowcase.tsx    (yeni — profil vitrini)
app/src/components/BadgePicker.tsx      (yeni — rozet seçim modal'ı)
app/leaderboard/page.tsx                (değişiklik — rozet ikonları ekleme)
```

### Rozet Tasarımı

Her `badge_type` için farklı bir ikon ve renk:

| Badge Type | İkon | Renk |
|------------|------|------|
| `weekly_stars_1st` | ⭐👑 | Altın |
| `weekly_stars_top3` | ⭐ | Gümüş |
| `weekly_levels_1st` | 🏔👑 | Altın |
| `weekly_levels_top3` | 🏔 | Gümüş |
| `weekly_records_1st` | 🏅👑 | Altın |
| `weekly_records_top3` | 🏅 | Gümüş |
| `monthly_creator_1st` | 🏗👑 | Altın |
| `monthly_creator_top3` | 🏗 | Gümüş |

Her rozet, `period_id` bilgisini tooltip olarak gösterir (mouse hover veya long press).

### BadgeIcon Component

```typescript
interface BadgeIconProps {
  badgeType: string;
  periodId: string;
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}
```

- SVG veya emoji bazlı ikonlar
- Neon glow efekti (altın/gümüş/bronz tier'a göre)
- Hover'da tooltip: "Haftalık Yıldız Şampiyonu — 2026-W23"

### BadgeShowcase Component

```typescript
interface BadgeShowcaseProps {
  uid: string;
  isOwner: boolean;  // true ise düzenleme butonu göster
}
```

- Sergilenen rozetler (maks 5): büyük, animasyonlu
- "Düzenle" butonu → BadgePicker modal açılır
- Tüm rozetler bölümü: collapsible grid

### BadgePicker Modal

- Kullanıcının tüm rozetleri grid olarak gösterilir
- Seçili olanlar highlight edilir
- Maks 5 seçilebilir
- "Kaydet" → `POST /badges/showcase` endpoint'i

### Profil Entegrasyonu

Mevcut profil sayfası veya UserBadge component'ı neredeyse — bak ve rozet vitrinini entegre et. Eğer ayrı bir profil sayfası yoksa `/profile` sayfası oluştur.

### Leaderboard Entegrasyonu

Agent 6'nın yazdığı `LeaderboardEntry` satırına, kullanıcının `showcaseBadges` bilgisini ekle:
- Leaderboard API response'ına `showcaseBadges` alanı eklenmediyse, ayrı bir endpoint ile çekilebilir veya bu özellik "nice to have" olarak sonraya bırakılabilir.
- **Şimdilik**: Leaderboard satırında sadece kendi rozet vitrinini göster.

### TypeScript Interface

```typescript
export interface Badge {
  id: string;
  uid: string;
  badgeType: string;
  periodId: string;
  rank: number;
  awardedAt: string;
}

export interface BadgesResponse {
  success: boolean;
  badges: Badge[];
}
```

### Rapor: `.agents/plans/plan1/agent7-rapor.md`

---

## Agent 8 — Arkadaş Sistemi

### Görev Özeti
- Arkadaş arama, ekleme, istekleri yönetme UI'ı
- Arkadaş listesi sayfası/bölümü
- Leaderboard'a "Arkadaşlar" sekmesi ekle

### Bağımlılık
- `app/src/lib/api/workerClient.ts` (Agent 6) — kullan
- `app/leaderboard/page.tsx` (Agent 6) — arkadaş sekmesi ekle

### Oluşturulacak/Değiştirilecek Dosyalar

```
app/src/lib/api/friendsClient.ts         (yeni)
app/src/hooks/useFriends.ts              (yeni)
app/src/components/FriendSearch.tsx      (yeni)
app/src/components/FriendRequestList.tsx (yeni)
app/src/components/FriendList.tsx        (yeni)
app/friends/page.tsx                     (yeni)
app/leaderboard/page.tsx                 (değişiklik — arkadaş sekmesi)
```

### Arkadaş Sayfası (`/friends`)

**Bölümler:**

1. **Kullanıcı Arama** — Tag ile arkadaş bul
   - Input: `#TAG` formatı
   - API: `GET /users/search?tag=XYZ`
   - Sonuç: Kullanıcı kartı + "Arkadaş Ekle" butonu

2. **Bekleyen İstekler** — Gelen arkadaşlık istekleri
   - API: `GET /friends/requests`
   - Her istek için: Kabul Et ✓ / Reddet ✗ butonları

3. **Arkadaş Listesi** — Mevcut arkadaşlar
   - API: `GET /friends`
   - Her arkadaş için: isim, tag, skor bilgisi (opsiyonel)
   - Kaldır butonu

**Erişim:**
- Anonim kullanıcılar bu sayfaya erişemez → "Arkadaş eklemek için giriş yap" mesajı

### Leaderboard Arkadaş Sekmesi

Agent 6'nın `/leaderboard` sayfasına yeni bir sekme ekle:

- Mevcut kategoriler: ⭐ Yıldız Avcıları | 🏔 Bölüm Fatihleri | 🏅 Rekortmenler | 🏗 Mimar
- **Ek sekme (en sağda)**: 👥 Arkadaşlar
- Bu sekme aktifken:
  - Dönem seçimi kaldır (her zaman "genel" göster veya haftalık göster)
  - API: `GET /leaderboard/stars/weekly?friends_only=true`
  - İçerik formatı normal leaderboard ile aynı

**Anonim kullanıcı için**: "Arkadaş eklemek için giriş yapın" placeholder.
**Arkadaşı olmayan kullanıcı için**: "Henüz arkadaşın yok — /friends sayfasında arkadaş ekle" mesajı.

### TypeScript Interface

```typescript
export interface Friend {
  uid: string;
  displayName: string | null;
  tag: string | null;
}

export interface FriendRequest {
  uid: string;
  displayName: string | null;
  tag: string | null;
  createdAt: string;
}

export interface FriendsResponse {
  success: boolean;
  friends: Friend[];
}

export interface FriendRequestsResponse {
  success: boolean;
  requests: FriendRequest[];
}

export interface UserSearchResult {
  success: boolean;
  uid: string | null;
  displayName: string | null;
  tag: string | null;
  areFriends: boolean;
  hasPendingRequest: boolean;
}
```

### Rapor: `.agents/plans/plan1/agent8-rapor.md`

---

## 🔄 İş Akışı

```
Agent 6: workerClient.ts + /leaderboard sayfası
     │
     ├── Agent 7: Rozet sistemi (BadgeIcon, BadgeShowcase, BadgePicker)
     │
     └── Agent 8: Arkadaş sistemi (/friends + leaderboard arkadaş sekmesi)
```

Agent 7 ve Agent 8, Agent 6 tamamlandıktan sonra **sırayla** çalıştırılmalı.
Agent 8, leaderboard sayfasını değiştireceği için Agent 7 bittikten sonra başlatılmalı.

---

## ⚡ Her Frontend Ajanına Söylenecek Şablon

```
Sen Faz [X]'ten sorumlusun (frontend).

Önce şu dosyaları oku:
1. .agents/plans/plan1/plan1.md (master plan, ilgili bölüm)
2. .agents/plans/plan1/frontend-plan.md (bu dosya — kendi görevin)
3. .agents/plans/plan1/agent{N-1}-rapor.md (önceki frontend ajanının raporu)
4. app/globals.css (tema ve mevcut CSS class'ları)
5. app/layout.tsx (genel yapı ve provider'lar)
6. app/page.tsx (mevcut sayfa stili örneği)
7. app/src/contexts/AuthContext.tsx (auth pattern)
8. app/src/lib/api/adminClient.ts (API client pattern)
9. app/src/store/userSlice.ts (Redux state)

Adım 1: Planla — nasıl kodlayacağını açıkla. Mevcut temayı / pattern'ları koru.
Adım 2: Kodla — temiz, type-safe TypeScript/TSX yaz.
Adım 3: Gözden geçir — eksik mi fazla mı? Kullanıcı deneyimi iyi mi?

Raporu yaz: .agents/plans/plan1/agent{N}-rapor.md
```

---

## 📝 Faz 14 ve 15 Notları

- **Faz 14 (Lig Backend):** Eğer backend ajanlarından biri zaten `league_groups` tablosunu oluşturdu ise frontend için hazır. Aksi halde ayrı bir backend ajana gönderilmeli (Faz 14 backend). Oyun için zorunlu değil ama sistemi tamamlar.
- **Faz 15 (Lig Frontend):** Faz 14 backend tamamlandıktan sonra Agent 9 (veya sonraki ajan) olarak planlanacak. Bu planın kapsamı dışında şimdilik.
