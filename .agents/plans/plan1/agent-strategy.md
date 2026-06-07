# 🎯 Ajan Orkestrasyon Stratejisi

Bu belge, hangi fazın hangi ajana verileceğini, her ajana ne söyleneceğini ve neden bu şekilde gruplandırıldığını açıklar.

---

## 📐 Genel Prensipler

### Ajan Yönetim Kuralları

1. **Her ajan 3 adımlı süreç izler:**
   - **Adım 1 — Planla:** Önce master planı (`plan1.md`) ve ilgili dosyaları oku, nasıl kodlayacağını planla. Planını yaz ve bana göster.
   - **Adım 2 — Kodla:** Planı onayladıktan sonra kodla.
   - **Adım 3 — Güvenlik Denetimi:** Yazdığın tüm kodun güvenlik açıklarını ara. SQL injection, input validation, authorization bypass, race condition, DoS vektörleri — her şeye karşı kurşun geçirmez yap.

2. **Her ajan sonunda rapor yazar:** `agent{N}-rapor.md` dosyasına ne yaptığını, hangi dosyaları oluşturduğunu/değiştirdiğini, ve bir sonraki ajan için önemli notları yazar.

3. **Yeni ajan önceki ajanın raporunu okur:** Bağımlılık zincirini anlamak için.

---

## 🗂️ Ajan Dağılımı

| Ajan | Fazlar | Kapsam | Neden Birlikte? |
|------|--------|--------|-----------------|
| **Agent 1** ✅ | Faz 1 | D1 Migration | Tamamlandı |
| **Agent 2** | Faz 2 + 3 + 4 + 5 | Skor Motoru + Profil Cache + Dünya Rekorları + Yaratıcı Puanları | Hepsi `complete-level` hook'unun içine yazılıyor. Aynı dosyayı değiştiriyorlar, aynı service'i genişletiyorlar. Tek ajan = tutarlı kod. |
| **Agent 3** | Faz 6 | Leaderboard API Endpoint'leri | Tamamen yeni bir route dosyası. Agent 2'nin yazdığı tablolardan sadece okuma yapıyor — bağımsız. |
| **Agent 4** | Faz 7 + 8 | Rozet Cron + Rozet Vitrin API | Rozet dağıtımı ve rozet yönetimi birbirine sıkı bağlı. Cron'u yazan, showcase endpoint'ini de yazsın. |
| **Agent 5** | Faz 9 + 10 | Arkadaş Sistemi + Arkadaş Leaderboard | Friendships tablosunu yazacak olan, friend leaderboard sorgusunu da yazsın. |
| **Agent 6+** | Faz 11–15 | Frontend + Ligler | İleride, backend tamamen hazır olduktan sonra. |

### Neden Bu Gruplama?

- **Agent 2 (Faz 2+3+4+5):** Bu 4 faz tek bir dosya etrafında döner: `game.ts` içindeki `complete-level` handler. Her biri bu handler'a bir ekleme yapıyor. Ayrı ajanlara vermek, aynı dosyayı 4 kez farklı biri tarafından değiştirmek demek — merge conflict ve tutarsızlık riski çok yüksek. Tek ajan hepsini bütüncül görsün.

- **Agent 3 (Faz 6):** Tamamen yeni dosyalar yaratıyor (route + types). Agent 2'nin yazdığı D1 tablolarına sadece SELECT sorguları atıyor. Bağımsız çalışabilir, temiz bir hafızayla başlamak avantaj.

- **Agent 4 (Faz 7+8):** Cron job + badge API birbirine sıkı bağlı. Cron'un yazdığı rozetleri API'nin okuması lazım — aynı ajan tasarlasın.

- **Agent 5 (Faz 9+10):** Friendships tablosuna yazan da okuyan da aynı ajan olsun. `friendships` tablosu canonical ordering ve simetrik sorgular gibi özel mantık gerektiriyor.

---

## 📋 Her Ajana Verilecek Talimatlar

---

### Agent 2 — Skor Takip Motoru (Faz 2 + 3 + 4 + 5)

**Oku:**
- `.agents/plans/plan1/plan1.md` (master plan, Faz 2-3-4-5 bölümleri)
- `.agents/plans/plan1/agent1-rapor.md` (Faz 1 raporu)
- `syncron-worker/migrations/0002_leaderboard.sql` (D1 tablo şeması — ne yazacağını bil)
- `syncron-worker/src/routes/game.ts` (mevcut complete-level — nereye hook ekleyeceksin)
- `syncron-worker/src/services/solutions.ts` (dünya rekorları — mevcut best solution mantığı)
- `syncron-worker/src/services/firestore.ts` (Firestore okuma/yazma helper'ları)
- `syncron-worker/src/types.ts` (mevcut tipler)
- `syncron-worker/src/services/auditLog.ts` (D1 yazma deseni — örnek al)

**Görev:**

Sen Faz 2, 3, 4 ve 5'ten sorumlusun. Bu 4 faz tek bir ortak noktada birleşiyor: `complete-level` API çağrıldığında D1 veritabanına ek veriler yazılması.

**Faz 2 — Skor Takibi:**
- Yeni service dosyası oluştur: `syncron-worker/src/services/leaderboard.ts`
- `getCurrentPeriodIds()` fonksiyonu yaz: Günün tarihinden `daily` (2026-06-07), `weekly` (2026-W23), `monthly` (2026-06), `all_time` period ID'lerini üret.
  - **Haftalık hesaplama:** ISO 8601 Week Number kullan. Pazartesi haftanın ilk günü.
- `upsertPeriodScores(db, uid, scoreDelta, isFirstCompletion)` fonksiyonu yaz: D1'deki `user_period_scores` tablosuna UPSERT. Günlük, haftalık ve all_time için üç satır birden yaz (batch statement veya 3 ayrı UPSERT).
- `game.ts`'deki `complete-level` handler'ına bu çağrıyı ekle. `waitUntil` ile asenkron yapabilirsin (response gecikmesin), ama hata logla.

**Faz 3 — Profil Cache:**
- `leaderboard.ts`'e `upsertUserProfile(db, uid, displayName, tag)` fonksiyonu ekle.
- `complete-level` handler'ında, kullanıcının Firestore user doc'unu zaten okuyorsun (totalScore güncellemesi için). Aynı akışta `displayName` ve `tag` alanlarını D1'e de yaz.
  - Dikkat: Mevcut kodda user doc okunmuyor — sadece transform/increment yapılıyor. Profil verilerini almak için ya ek bir Firestore GET yap, ya da (tercih edilen) complete-level request body'sine `displayName` ve `tag` ekle. Ama güvenlik açısından istemciden gelen veriyi değil, Firestore'daki veriyi kullan. Bir kerelik ek bir Firestore okuma kabul edilebilir.

**Faz 4 — Dünya Rekorları:**
- `updateSolutions()` çağrılmadan ÖNCE, mevcut en iyi çözümün sahibinin uid'sini oku (`solutions` dokümanından).
- `updateSolutions()` çağrıldıktan SONRA, eğer `isNewBestSolution` ise:
  - Yeni rekor sahibinin `user_world_records` tablosunda günlük ve haftalık `records_count` +1 (UPSERT).
  - Yeni rekor sahibinin `all_time` `records_count` +1 (UPSERT).
  - Eski rekor sahibinin (varsa ve farklı bir kullanıcıysa) `all_time` `records_count` -1 (ama CHECK constraint `>= 0` var, buna dikkat et — eğer 0'sa zaten düşmez, hata yakala veya `MAX(0, records_count - 1)` kullan).
  - Eski rekor sahibinin günlük/haftalık sayacını DEĞİŞTİRME — onlar "o dönemde kaç rekor kırıldı" anlamına gelir.

**Faz 5 — Yaratıcı Puanları:**
- `complete-level` handler'ında, tamamlanan seviyenin `createdBy` alanını kontrol et (Firestore level doc'unda mevcut — `parseLevelDoc` ile zaten okunuyor).
- Eğer level doc'ta `createdBy` varsa VE `createdBy !== uid` (yaratıcı kendisi oynamıyorsa):
  - `creator_scores` tablosuna UPSERT: `plays_gained` +1, `stars_gained` += kazanılan yıldız. `monthly` ve `all_time` dönemleri için.
- `parseLevelDoc()` fonksiyonunu veya `fromDoc()` çıktısını `createdBy` alanını da içerecek şekilde güncelle (şu an `createdBy` parse edilmiyor — ekle).

**Güvenlik:**
- Tüm D1 sorguları parameterized olmalı (`.bind()` ile). String interpolation YASAK.
- Sayaçların negatife düşmesi engellenmeli (D1 CHECK constraint zaten var ama kod tarafında da dikkatli ol).
- `getCurrentPeriodIds()` fonksiyonu UTC zaman dilimini kullanmalı (sunucu time zone'una bağımlı olmamalı).
- Firestore'dan gelen `displayName` ve `tag`'in uzunluk sınırlarını D1 CHECK constraint'leriyle uyumlu şekilde validate et.

**Çıktı dosyaları:**
- `syncron-worker/src/services/leaderboard.ts` (yeni)
- `syncron-worker/src/routes/game.ts` (değişiklik)
- `syncron-worker/src/services/solutions.ts` (değişiklik — eski rekor sahibi uid okuma)
- `syncron-worker/src/services/firestore.ts` (muhtemelen küçük değişiklik — `createdBy` parse)
- `syncron-worker/src/types.ts` (muhtemelen küçük değişiklik)

**Rapor:** `.agents/plans/plan1/agent2-rapor.md`

---

### Agent 3 — Leaderboard API (Faz 6)

**Oku:**
- `.agents/plans/plan1/plan1.md` (master plan, Faz 6 bölümü)
- `.agents/plans/plan1/agent1-rapor.md` (D1 şema bilgisi)
- `.agents/plans/plan1/agent2-rapor.md` (skor motoru, hangi tablolara ne yazıldığı)
- `syncron-worker/migrations/0002_leaderboard.sql` (tablo yapısı — sorgulayacağın şema)
- `syncron-worker/src/services/leaderboard.ts` (Agent 2'nin yazdığı servis — yeniden kullanabilirsin)
- `syncron-worker/src/index.ts` (route kaydı nasıl yapılıyor)
- `syncron-worker/src/middleware/auth.ts` (auth middleware)
- `syncron-worker/src/routes/game.ts` (route örneği)
- `syncron-worker/src/routes/adminApi.ts` (GET route örneği)

**Görev:**

Sen Faz 6'dan sorumlusun: Leaderboard API endpoint'leri.

- Yeni route dosyası oluştur: `syncron-worker/src/routes/leaderboard.ts`
- `index.ts`'e route kaydını ekle.
- Yeni schema dosyası (isteğe bağlı): `syncron-worker/src/schemas/leaderboard.ts`

**Endpoint:**

```
GET /leaderboard/:category/:period
```

- **`:category`**: `stars` | `levels` | `records` | `creators`
- **`:period`**: `daily` | `weekly` | `monthly` | `all_time`
  - Validasyon: `stars` ve `levels` → daily/weekly/all_time | `records` → daily/weekly/all_time | `creators` → monthly/all_time
  - Geçersiz kombinasyonlar 400 dönsün.

**Query parametreleri:**
- `limit` (varsayılan: 50, maks: 100) — kaç oyuncu gösterilsin
- `around_me` (`true`/`false`) — çağıran kullanıcının etrafı

**Auth:**
- Auth opsiyonel olsun. Token varsa uid al, yoksa anonim devam et.
- `around_me=true` ise auth zorunlu — token yoksa 401 dönsün.
- Yeni bir middleware yazabilirsin: `optionalFirebaseAuth` — token varsa verify et, yoksa uid=null olarak devam et.

**SQL Sorguları:**
- Her kategori farklı bir tabloyu sorgular:
  - `stars` → `user_period_scores` ORDER BY `stars_gained` DESC
  - `levels` → `user_period_scores` ORDER BY `levels_done` DESC
  - `records` → `user_world_records` ORDER BY `records_count` DESC
  - `creators` → `creator_scores` ORDER BY `plays_gained` DESC, `stars_gained` DESC
- Her sorgu `user_profiles` ile LEFT JOIN yaparak `display_name` ve `tag` çeksin.
- `around_me` mantığı: Önce kullanıcının sırasını bul (COUNT sorgusu), sonra etrafındaki ±5 oyuncuyu çek.
- `totalPlayers`: O dönem/kategoride kaç benzersiz oyuncu olduğu (COUNT sorgusu).

**Response:**
```json
{
  "success": true,
  "category": "stars",
  "period": "weekly",
  "periodId": "2026-W23",
  "entries": [
    { "rank": 1, "uid": "abc", "displayName": "Oyuncu1", "tag": "PRO", "value": 47 }
  ],
  "myRank": 15,
  "myValue": 12,
  "totalPlayers": 234
}
```

**Güvenlik:**
- Tüm path parametreleri ve query parametreleri sanitize ve validate edilmeli.
- `limit` > 100 ise 100'e kırp.
- SQL injection yoksa bile, tüm sorgular parameterized olmalı.
- Rate limiting düşünülebilir ama ilk aşamada gerekli değil.

**Çıktı dosyaları:**
- `syncron-worker/src/routes/leaderboard.ts` (yeni)
- `syncron-worker/src/middleware/auth.ts` (değişiklik — optionalFirebaseAuth ekleme)
- `syncron-worker/src/index.ts` (değişiklik — route kaydı)
- `syncron-worker/src/schemas/leaderboard.ts` (yeni, opsiyonel)

**Rapor:** `.agents/plans/plan1/agent3-rapor.md`

---

### Agent 4 — Rozet Sistemi (Faz 7 + 8)

**Oku:**
- `.agents/plans/plan1/plan1.md` (master plan, Faz 7 ve 8 bölümleri)
- `.agents/plans/plan1/agent1-rapor.md`, `agent2-rapor.md`, `agent3-rapor.md`
- `syncron-worker/migrations/0002_leaderboard.sql` (badges tablosu)
- `syncron-worker/src/scheduled/logRetention.ts` (cron job örneği — aynı deseni kullan)
- `syncron-worker/wrangler.jsonc` (cron trigger ekleme)
- `syncron-worker/src/index.ts` (scheduled export)
- `firestore.rules` (showcaseBadges alanı ekleme)

**Görev:**

**Faz 7 — Cron Rozet Dağıtımı:**
- Yeni scheduled dosya: `syncron-worker/src/scheduled/badgeDistribution.ts`
- İki cron trigger:
  - **Haftalık**: Her Pazartesi 00:05 UTC → `stars`, `levels`, `records` kategorilerinin bir önceki haftanın (period_id hesapla) top 3'üne rozet ver.
  - **Aylık**: Her ayın 1'i 00:05 UTC → `creators` kategorisinin bir önceki ayın top 3'üne rozet ver.
- Her kategori için D1'den top 3 sorgula, `badges` tablosuna INSERT (UNIQUE index sayesinde duplicate safe — INSERT OR IGNORE kullan).
- `wrangler.jsonc`'deki `crons` dizisine yeni trigger'ları ekle.
- `index.ts`'deki `scheduled` handler'ı, hangi cron tetiklendiğini ayırt edecek şekilde güncelle (`event.cron` ile).

**Faz 8 — Rozet Vitrin:**
- Yeni route dosyası: `syncron-worker/src/routes/badges.ts`
- `GET /badges/:uid` — Kullanıcının tüm rozetlerini D1'den çek.
- `POST /badges/showcase` — Kullanıcı sergilemek istediği rozet ID'lerini gönderir (maks 5).
  - Body: `{ "badgeIds": ["id1", "id2", "id3"] }`
  - Validation: ID'ler gerçekten bu kullanıcıya ait mi kontrol et.
  - Firestore `users/{uid}` dokümanına `showcaseBadges` array'i yaz (Admin SDK ile).
- `firestore.rules` güncelle: kullanıcı sadece kendi `showcaseBadges` alanını güncelleyebilsin.
- `index.ts`'e route kaydı ekle.

**Çıktı dosyaları:**
- `syncron-worker/src/scheduled/badgeDistribution.ts` (yeni)
- `syncron-worker/src/routes/badges.ts` (yeni)
- `syncron-worker/wrangler.jsonc` (değişiklik)
- `syncron-worker/src/index.ts` (değişiklik)
- `firestore.rules` (değişiklik)

**Rapor:** `.agents/plans/plan1/agent4-rapor.md`

---

### Agent 5 — Arkadaş Sistemi (Faz 9 + 10)

**Oku:**
- `.agents/plans/plan1/plan1.md` (master plan, Faz 9 ve 10 bölümleri)
- Tüm önceki ajan raporları
- `syncron-worker/migrations/0002_leaderboard.sql` (friendships tablosu + user_profiles tablosu)
- `syncron-worker/src/routes/leaderboard.ts` (Agent 3'ün yazdığı — friends_only parametresi eklenecek)
- `syncron-worker/src/middleware/auth.ts` (auth middleware)

**Görev:**

**Faz 9 — Arkadaş Sistemi:**
- Yeni route dosyası: `syncron-worker/src/routes/friends.ts`
- Endpoint'ler:
  - `POST /friends/request` — Body: `{ "targetUid": "..." }` veya `{ "targetTag": "..." }`. Tag ile de istek gönderilebilsin.
  - `POST /friends/accept` — Body: `{ "uid": "..." }` (isteği gönderenin uid'si).
  - `POST /friends/reject` — Body: `{ "uid": "..." }`.
  - `DELETE /friends/:uid` — Arkadaşlığı kaldır.
  - `GET /friends` — Kabul edilmiş arkadaş listesi (display_name ve tag ile birlikte).
  - `GET /friends/requests` — Bekleyen gelen istekler.
  - `GET /users/search?tag=XYZ` — Tag ile kullanıcı arama (D1 user_profiles).
- Tümü `firebaseAuth` middleware'i ile korunacak (anonim kullanıcılar arkadaş ekleyemez — token'dan auth provider kontrol edilebilir veya Firestore'dan provider bilgisi alınabilir).
- Canonical ordering (user_a < user_b) worker kodunda her zaman uygulanmalı.
- Maks arkadaş limiti: 100 — her request'te COUNT sorgusu ile kontrol et.

**Faz 10 — Arkadaş Leaderboard:**
- Agent 3'ün yazdığı `leaderboard.ts` route dosyasına `friends_only=true` query parametresi desteği ekle.
- Eğer `friends_only=true`:
  1. D1'den kullanıcının arkadaş uid listesini çek.
  2. Bu uid'ler + kullanıcının kendi uid'si ile `user_period_scores` / `user_world_records` / `creator_scores` tablosunu filtrele.
  3. Aynı response formatı kullan.
- Auth zorunlu (token yoksa 401).

**Güvenlik:**
- Canonical ordering bug'ları: `user_a < user_b` kuralını kod tarafında her zaman uygula, D1 CHECK constraint'e güvenme (defense in depth).
- Bir kullanıcı engellediği (blocked) kişiyi arayamazın — search endpoint'inde blocked filtreleme yap.
- Rate limiting: Arkadaşlık isteği spam'ini engellemek için pending request limiti koy (maks 20 bekleyen giden istek).

**Çıktı dosyaları:**
- `syncron-worker/src/routes/friends.ts` (yeni)
- `syncron-worker/src/routes/leaderboard.ts` (değişiklik — friends_only)
- `syncron-worker/src/index.ts` (değişiklik — route kaydı)
- `syncron-worker/src/schemas/friends.ts` (yeni, opsiyonel)

**Rapor:** `.agents/plans/plan1/agent5-rapor.md`

---

## 🔄 İş Akışı Diyagramı

```
Agent 1 (Faz 1) ✅ Tamamlandı
     │
     ▼
Agent 2 (Faz 2+3+4+5) ← Skor toplama motoru
     │
     ▼
Agent 3 (Faz 6) ← Leaderboard API
     │
     ├──────────────────┐
     ▼                  ▼
Agent 4 (Faz 7+8)   Agent 5 (Faz 9+10)
Rozet Sistemi         Arkadaş Sistemi
     │                  │
     ▼                  ▼
  [Frontend Fazları — İleride]
```

> Agent 3 tamamlandıktan sonra Agent 4 ve Agent 5 **birbirinden bağımsızdır** ve paralel olarak çalıştırılabilir. Ancak sıralı yapmak daha güvenlidir — merge conflict riski sıfır olur.

---

## ⚡ Hızlı Referans: Ajanlara Söylenecek Şablon

Her ajana şunu söyle (faz numarasını ve ajan numarasını değiştirerek):

```
Sen Faz X'ten sorumlusun. 

Öncelikle şu dosyaları oku:
1. .agents/plans/plan1/plan1.md (master plan — Faz X bölümü)
2. .agents/plans/plan1/agent-strategy.md (Agent N talimatları)
3. .agents/plans/plan1/agent{N-1}-rapor.md (önceki ajanın raporu)
4. [İlgili kaynak dosyaları — strategy dosyasında listeleniyor]

Adım 1: Nasıl kodlayacağını planla. Uyarılara dikkat et. 
Master planda ve strategy dosyasında yazandan ne eksik ne fazla bir şey kodlayacak şekilde planla.

Adım 2: Planı onayladıktan sonra kodla.

Adım 3: Yazdığın kodun güvenliğinden de sorumlusun. Tüm güvenlik açıklarını ara.
SQL injection, input validation, authorization bypass, race condition, DoS vektörleri — 
her şeye karşı kurşun geçirmez olmasını sağla.

Sonunda raporunu yaz: .agents/plans/plan1/agent{N}-rapor.md
```

---

## 📊 Token Verimliliği Notu

Bu gruplama, token kullanımını optimize eder:

- **Agent 2 (4 faz birden)**: `game.ts` dosyasını 4 kez okumak yerine 1 kez okur. Aynı service dosyasını baştan sona tutarlı yazar. ~%40 token tasarrufu (tahmini).
- **Agent 3 (tek faz)**: Temiz hafıza — sadece tablo şemasını ve önceki raporları okur. Karmaşık `complete-level` mantığını bilmesine gerek yok.
- **Agent 4 ve 5**: Birbirinden bağımsız — birinin hata yapması diğerini etkilemez.
