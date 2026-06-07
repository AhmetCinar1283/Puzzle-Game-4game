# 🏆 Büyük Güncelleme Yol Haritası — Lider Tabloları, Rozetler ve Arkadaş Sistemi

Bu belge, tüm güncellemenin **yapılma sırasına** göre düzenlenmiş ana fazlarını (phases) içerir.
Her faz, bir sonrakinin temelini oluşturur — **sıralama önemlidir ve atlanamaz.**

Her fazın sonunda çalışan, test edilmiş bir sistem parçası ortaya çıkmalıdır.

---

## 📋 Özet Tablo

| Faz | Sistem | Bağımlılık | Kapsam |
|-----|--------|------------|--------|
| 1 | D1 Veritabanı Şeması | — | Worker (migration) |
| 2 | Skor Takip Motoru | Faz 1 | Worker (`complete-level` hook) |
| 3 | Kullanıcı Profil Cache | Faz 1 | Worker (kullanıcı isim/tag D1'e yazma) |
| 4 | Dünya Rekoru Takip Sistemi | Faz 1, 2 | Worker (solutions + D1) |
| 5 | Yaratıcı Puan Sistemi | Faz 1, 2, 3 | Worker (seviye onayı + oynanma takibi) |
| 6 | Leaderboard API | Faz 1–5 | Worker (yeni route'lar) |
| 7 | Cron: Haftalık/Aylık Rozet Dağıtımı | Faz 6 | Worker (scheduled + Firestore badge yazma) |
| 8 | Rozet Vitrin Sistemi | Faz 7 | Worker + Firestore rules |
| 9 | Arkadaş Sistemi Backend | Faz 3 | Worker + D1 veya Firestore |
| 10 | Arkadaş Leaderboard API | Faz 6, 9 | Worker (arkadaş sıralaması endpoint) |
| 11 | Frontend: Leaderboard Sayfaları | Faz 6 | Next.js app |
| 12 | Frontend: Profil Rozet Vitrini | Faz 8 | Next.js app |
| 13 | Frontend: Arkadaş Yönetimi | Faz 9, 10 | Next.js app |
| 14 | Haftalık Lig Sistemi (30 Kişilik Gruplar) | Faz 6, 9 | Worker + D1 |
| 15 | Frontend: Lig Sayfası | Faz 14 | Next.js app |

---

## Faz 1 — D1 Veritabanı Şeması (Temel)

**Ne yapılacak:** Cloudflare D1 veritabanına leaderboard sisteminin tüm ihtiyacını karşılayacak tabloları ekleyen yeni bir migration dosyası yazılacak.

**Tablolar:**

1. **`user_profiles`** — Firestore'dan denormalize edilmiş kullanıcı bilgileri (displayName, tag). Leaderboard sorguları Firestore'a gitmeden isim gösterebilsin diye gerekli.

2. **`user_period_scores`** — Dönemlik skor takibi. Her kullanıcının günlük/haftalık/aylık bazda kazandığı yıldız ve tamamladığı seviye sayısı.
   - `period_type`: `'daily'` | `'weekly'` | `'monthly'`
   - `period_id`: `'2026-06-07'` | `'2026-W23'` | `'2026-06'`

3. **`user_world_records`** — Kullanıcıların kaç seviyede dünya rekoru tuttuğunu takip eden tablo. Dönemlik bazda (günlük/haftalık/genel) güncellenecek.

4. **`creator_scores`** — Seviye yaratıcılarının puanları. Ürettiği seviyelerin toplam oynanma/tamamlanma sayısı ve kazandırdığı toplam yıldız. Aylık ve genel (all-time) dönemlik.

5. **`badges`** — Kullanıcılara verilen rozetler (haftalık şampiyon, aylık en iyi mimar vb.)

6. **`friendships`** — Arkadaşlık ilişkileri tablosu.

**Çıktı:** `syncron-worker/migrations/0002_leaderboard.sql` dosyası. Tüm tablolar, indeksler ve kısıtlamalar (constraints).

> [!IMPORTANT]
> Bu fazda sadece migration SQL dosyası yazılacak. Worker kodu değişmeyecek. `wrangler d1 migrations apply` ile deploy edildikten sonra Faz 2'ye geçilecek.

---

## Faz 2 — Skor Takip Motoru (Veri Toplama Başlasın)

**Ne yapılacak:** `complete-level` route'unda seviye tamamlandığında, mevcut Firestore yazımlarına ek olarak D1'e de dönemlik skorlar yazılacak.

**Detaylar:**

- `game.ts` içindeki `complete-level` handler'ına ekleme yapılacak.
- Seviye tamamlandığında hesaplanan `scoreDelta` (yıldız kazancı) ve `isFirstCompletion` bilgileri D1'e de yazılacak.
- Yazılacak dönemler: **günlük** (`2026-06-07`), **haftalık** (`2026-W23`), **aylık** (`2026-06`).
- Tek seferde üç periyoda birden UPSERT yapılacak (INSERT ... ON CONFLICT DO UPDATE).
- Yeni bir service dosyası: `syncron-worker/src/services/leaderboard.ts` — dönem hesaplama (`getCurrentPeriodIds()`) ve UPSERT fonksiyonları burada olacak.
- `waitUntil` ile yapılabilir (response'u geciktirmesin), ama veri kaybı riski varsa senkron da olabilir — geliştiricinin kararına bırakılabilir.

**Çıktı:** Bir oyuncu seviye tamamladığında D1'de `user_period_scores` tablosuna otomatik kayıt düşecek.

> [!NOTE]
> Bu faz tamamlandıktan sonra leaderboard verisi toplanmaya başlar. Geçmişe dönük veri olmayacak — bu beklenen bir durumdur. İsteğe bağlı olarak mevcut Firestore `playedLevels` verilerinden bir kerelik backfill script'i yazılabilir ama bu zorunlu değil.

---

## Faz 3 — Kullanıcı Profil Cache (İsim Gösterimi)

**Ne yapılacak:** Leaderboard'da kullanıcı adlarını göstermek için Firestore'dan her seferinde isim çekmek yerine, D1'de bir `user_profiles` cache tablosu tutulacak.

**Detaylar:**

- `complete-level` handler'ında (Faz 2'deki aynı akışta), kullanıcının Firestore'dan zaten okunan `displayName` ve `tag` bilgisi D1'deki `user_profiles` tablosuna UPSERT edilecek.
- Bu sadece her `complete-level` çağrısında güncellenir — ayrı bir sync mekanizması gerekmez.
- Kullanıcı adını veya tag'ini değiştirirse, bir sonraki seviye tamamlamasında D1 cache otomatik güncellenir.
- **Alternatif/ek**: Kullanıcı profil güncellemesi yapıldığında (tag değişikliği vb.) da bu cache'in güncellenmesi için ayrı bir endpoint veya Firestore trigger düşünülebilir ama ilk aşamada gereksiz.

**Çıktı:** D1'de `user_profiles` tablosu dolu olacak, leaderboard sorguları JOIN ile isim çekebilecek.

---

## Faz 4 — Dünya Rekoru Takip Sistemi

**Ne yapılacak:** "Rekortmenler" kategorisi için, hangi kullanıcının kaç seviyede dünya rekoru (en az hamleyle çözüm) tuttuğu takip edilecek.

**Detaylar:**

- Mevcut `solutions.ts` servisi zaten her seviye için top-3 çözümü tutuyor (`levels/{id}/infos/solutions`).
- `updateSolutions()` fonksiyonu çağrıldıktan sonra, eğer yeni bir dünya rekoru kırıldıysa (`isNewBestSolution` zaten hesaplanıyor):
  - **Yeni rekor sahibinin** `user_world_records` tablosundaki günlük/haftalık/genel sayacı +1 artırılacak.
  - **Eski rekor sahibinin** (eğer varsa) genel sayacı -1 azaltılacak.
    - Günlük/haftalık sayaçları değişmez — onlar "o dönemde kaç rekor kırıldı" anlamına gelir.
- Eski rekor sahibinin uid'si, solutions dokümanından `updateSolutions()` çağrılmadan önce okunabilir.

**Çıktı:** D1'de her kullanıcının kaç aktif dünya rekoruna sahip olduğu (genel) ve o dönem içinde kaç yeni rekor kırdığı (günlük/haftalık) takip edilecek.

> [!IMPORTANT]
> Bu faz, Faz 2'deki `leaderboard.ts` service dosyasına ek fonksiyonlar ekleyerek genişletilecek. Ayrı bir service yapmaya gerek yok.

---

## Faz 5 — Yaratıcı Puan Sistemi (Usta Mimarlar)

**Ne yapılacak:** Topluluk seviyesi yaratıcılarının puanını takip eden sistem. Bir yaratıcının ürettiği seviyelerin diğer oyuncular tarafından tamamlanma sayısı ve kazandırdığı yıldızlar.

**Detaylar:**

- `complete-level` handler'ında, tamamlanan seviyenin `createdBy` alanı kontrol edilecek (zaten Firestore level doc'unda mevcut).
- Eğer seviye bir topluluk seviyesiyse (`createdBy` alanı varsa ve `createdBy !== uid` yani yaratıcı kendisi oynamıyorsa):
  - `creator_scores` tablosunda yaratıcının aylık ve genel sayaçları güncellenecek:
    - `plays_gained` +1 (seviye tamamlandıysa)
    - `stars_gained` += kazanılan yıldız sayısı
- **Dönemler:** Sadece `monthly` (`2026-06`) ve `all_time`.
- Yaratıcının `uid`'si zaten `createdBy` alanından geliyor — ek bir okuma gerekmiyor.

**Çıktı:** Yaratıcılar, seviyelerinin ne kadar oynadığına göre puan kazanacak. Aylık ve genel sıralamada görünecekler.

> [!NOTE]
> İlk aşamada sadece admin tarafından onaylanıp `levels/` koleksiyonuna eklenen seviyeler sayılacak. `levelRequests` (pending/rejected) seviyeler sayılmayacak.

---

## Faz 6 — Leaderboard API Endpoint'leri

**Ne yapılacak:** Tüm lider tablolarını istemciye sunan yeni route'lar oluşturulacak.

**Endpoint'ler:**

```
GET /leaderboard/:category/:period
```

- **`:category`**: `stars` | `levels` | `records` | `creators`
- **`:period`**: `daily` | `weekly` | `monthly` | `all_time`
  - `stars` ve `levels`: daily, weekly, all_time
  - `records`: daily, weekly, all_time
  - `creators`: monthly, all_time

**Query parametreleri:**
- `limit` (varsayılan: 50, maks: 100)
- `around_me` (boolean) — Eğer `true` ise, çağıran kullanıcının sırasını ve etrafındaki ±5 oyuncuyu döner.

**Response yapısı:**
```json
{
  "success": true,
  "category": "stars",
  "period": "weekly",
  "periodId": "2026-W23",
  "entries": [
    { "rank": 1, "uid": "abc", "displayName": "Oyuncu1", "tag": "PRO", "value": 47 },
    { "rank": 2, "uid": "def", "displayName": "Oyuncu2", "tag": null, "value": 42 }
  ],
  "myRank": 15,
  "myValue": 12,
  "totalPlayers": 234
}
```

**Teknik:**
- Tüm sorgular D1 üzerinde yapılacak (`user_period_scores` + `user_profiles` JOIN).
- All-time `stars` ve `levels` için de D1 kullanılacak (all_time period olarak yazılacak).
- Auth middleware (`firebaseAuth`) kullanılacak — `around_me` için uid gerekli.
  - Anonim/giriş yapmamış kullanıcılar da tabloyu görebilmeli ama `around_me` alamaz. Bu yüzden auth **opsiyonel** olabilir (varsa uid al, yoksa geç).
- **Cache**: İlk aşamada cache gerekmez. İleride Cloudflare KV ile 5-10 dakikalık cache eklenebilir ama bu ayrı bir faz olarak planlanmayacak — performans gerekirse o zaman eklenir.

**Çıktı:** `syncron-worker/src/routes/leaderboard.ts` dosyası ve `index.ts`'e route kaydı.

> [!IMPORTANT]
> Bu faz, frontend'siz bile test edilebilir olmalı. `curl` veya Postman ile tüm endpoint'ler test edilmeli.

---

## Faz 7 — Cron: Dönem Sonu Rozet Dağıtımı

**Ne yapılacak:** Her hafta ve ayın sonunda, o dönemin lider tablolarının ilk 3'üne (veya ilk 10'una) otomatik rozet veren bir cron job.

**Detaylar:**

- Yeni bir cron trigger eklenecek: `wrangler.jsonc`'deki `crons` dizisine ekleme.
  - **Haftalık**: Her Pazartesi 00:05 UTC (hafta sıfırlandıktan 5 dk sonra) — Stars, Levels, Records kategorilerinin haftalık birincilerine rozet ver.
  - **Aylık**: Her ayın 1'i 00:05 UTC — Creators kategorisinin aylık birincilerine rozet ver.
- Cron handler'ı:
  1. D1'den bir önceki dönemin (`period_id`) top 3 oyuncusunu sorgular (her kategori için).
  2. Her kazanana D1 `badges` tablosuna bir rozet kaydı ekler:
     - `uid`, `badge_type` (`weekly_stars_champion`, `weekly_stars_top3`, `monthly_creator_champion` vb.), `period_id`, `rank`, `awarded_at`.
  3. **(İsteğe bağlı)**: Firestore'daki kullanıcı dokümanına da `badges` array'ine ekleme yapılabilir — ama bu frontend fazında düşünülecek.
- Yeni scheduled dosya: `syncron-worker/src/scheduled/badgeDistribution.ts`

**Rozet Tipleri (ilk sürüm):**

| Badge Type | Açıklama | Dönem |
|------------|----------|-------|
| `weekly_stars_1st` | Haftalık Yıldız Şampiyonu (1.) | Haftalık |
| `weekly_stars_top3` | Haftalık Yıldız Top 3 (2. ve 3.) | Haftalık |
| `weekly_levels_1st` | Haftalık Seviye Şampiyonu | Haftalık |
| `weekly_levels_top3` | Haftalık Seviye Top 3 | Haftalık |
| `weekly_records_1st` | Haftalık Rekor Şampiyonu | Haftalık |
| `weekly_records_top3` | Haftalık Rekor Top 3 | Haftalık |
| `monthly_creator_1st` | Aylık En İyi Mimar | Aylık |
| `monthly_creator_top3` | Aylık Mimar Top 3 | Aylık |

**Çıktı:** Haftanın ve ayın sonunda otomatik rozet dağıtılacak. Rozetler D1'de saklanacak.

---

## Faz 8 — Rozet Vitrin Sistemi

**Ne yapılacak:** Kullanıcıların kazandıkları rozetlerden istediklerini profillerinde sergileyebilmesi için backend altyapısı.

**Detaylar:**

- Yeni endpoint: `GET /badges/:uid` — Bir kullanıcının tüm rozetlerini listeler.
- Yeni endpoint: `POST /badges/showcase` — Kullanıcı, sergilemek istediği rozetlerin ID listesini gönderir (maks 3–5 rozet).
  - Firestore `users/{uid}` dokümanına `showcaseBadges` alanı eklenir.
  - Firestore security rules güncellenir — kullanıcı sadece kendi `showcaseBadges` alanını güncelleyebilmeli.
- Leaderboard API response'larına da kullanıcıların `showcaseBadges` bilgisi eklenir (D1'den veya Firestore'dan — tasarım kararı geliştiriciye bırakılabilir).

**Çıktı:** Rozetleri yönetme API'leri çalışır durumda.

---

## Faz 9 — Arkadaş Sistemi Backend

**Ne yapılacak:** Kullanıcıların birbirlerini arkadaş olarak ekleyip, kaldırabilmesi.

**Detaylar:**

- **Veri Modeli (D1 `friendships` tablosu):**
  - `user_a` (uid, alfabetik olarak küçük olan) + `user_b` (uid, büyük olan) → simetrik arkadaşlık.
  - `status`: `'pending'` | `'accepted'` | `'blocked'`
  - `requested_by`: isteği gönderenin uid'si.
  - `created_at`, `updated_at`.
  - Her iki yöndeki sorguyu hızlı yapmak için iki indeks: `(user_a, status)` ve `(user_b, status)`.

- **Endpoint'ler:**
  - `POST /friends/request` — Arkadaşlık isteği gönder (hedef uid).
  - `POST /friends/accept` — İsteği kabul et.
  - `POST /friends/reject` — İsteği reddet.
  - `DELETE /friends/:uid` — Arkadaşlığı kaldır.
  - `GET /friends` — Mevcut arkadaş listesi.
  - `GET /friends/requests` — Bekleyen arkadaşlık istekleri.

- **Kurallar:**
  - Anonim kullanıcılar arkadaş ekleyemez.
  - Maksimum arkadaş limiti: 100 (ilk aşamada).
  - Kullanıcılar birbirlerini tag ile bulabilir (tag benzersiz olduğu için).

- **Tag ile kullanıcı arama:**
  - `GET /users/search?tag=XYZ` — Tag ile kullanıcı arar. Sadece giriş yapmış kullanıcılar kullanabilir.
  - D1 `user_profiles` tablosundan arama yapılır.

**Çıktı:** Arkadaş ekleme/çıkarma sistemi çalışır durumda. `syncron-worker/src/routes/friends.ts`

---

## Faz 10 — Arkadaş Leaderboard API

**Ne yapılacak:** Bir kullanıcının arkadaşları arasındaki leaderboard sıralaması.

**Detaylar:**

- Mevcut `GET /leaderboard/:category/:period` endpoint'ine `friends_only=true` query parametresi eklenir.
- Bu durumda:
  1. Önce D1'den kullanıcının arkadaş listesi çekilir (Faz 9'daki `friendships` tablosu).
  2. Sonra bu arkadaşların uid'leri ile `user_period_scores` tablosu filtrelenir.
  3. Kullanıcının kendisi de listeye dahil edilir.
- Sıralama/response formatı normal leaderboard ile aynı.

**Çıktı:** Arkadaş sıralaması API'si çalışır durumda.

---

## Faz 11 — Frontend: Leaderboard Sayfaları

**Ne yapılacak:** Lider tablolarını gösteren frontend sayfaları.

**Detaylar:**

- Yeni sayfa: `/leaderboard`
- Üst kısımda kategori seçim tabları: ⭐ Yıldız Avcıları | 🏔 Bölüm Fatihleri | 🏅 Rekortmenler | 🏗 Usta Mimarlar
- Her kategorinin altında dönem seçici: Günlük | Haftalık | (Aylık — sadece mimarlar için) | Genel
- Sıralama listesi: Top 50 oyuncu, oyuncunun yanında rozet ikonları.
- Listenin altında veya ayrı bir bölümde: **"Senin Sıran"** — kullanıcının kendi sırası ve etrafındaki oyuncular (nearby display).
- Arkadaş filtresi: Eğer kullanıcının arkadaşları varsa, "Arkadaşlar" sekmesi eklenir.
- **Tasarım:** Modern, oyun temalı, animasyonlu. İlk 3 oyuncu podyum tarzı öne çıkarılmalı.

**Çıktı:** Çalışan leaderboard sayfası.

---

## Faz 12 — Frontend: Profil Rozet Vitrini

**Ne yapılacak:** Kullanıcıların profilinde kazandığı rozetleri sergilemesi.

**Detaylar:**

- Profil sayfasında "Rozetlerim" bölümü.
- Tüm rozetler grid olarak gösterilir.
- Kullanıcı, profil vitrininde göstermek istediği rozetleri (maks 3–5) seçebilir.
- Seçilen rozetler, leaderboard'daki kullanıcı adının yanında da görünür.

**Çıktı:** Rozet vitrini çalışır durumda.

---

## Faz 13 — Frontend: Arkadaş Yönetimi

**Ne yapılacak:** Arkadaş ekleme, kaldırma, istek gönderme/kabul etme arayüzü.

**Detaylar:**

- Profil veya ayarlar sayfasında "Arkadaşlar" bölümü.
- Tag ile arama ve arkadaşlık isteği gönderme.
- Bekleyen istekleri görme ve kabul/reddetme.
- Mevcut arkadaş listesi (tıklayınca profil görüntüle).

**Çıktı:** Arkadaş yönetim arayüzü çalışır durumda.

---

## Faz 14 — Haftalık Lig Sistemi (30 Kişilik Gruplar) *(Gelecek)*

**Ne yapılacak:** Duolingo tarzı, 30 kişilik rastgele haftalık yarış grupları.

**Detaylar:**

- Her Pazartesi sıfırlanan, 30 kişilik gruplar otomatik oluşturulur.
- Grup içindeki sıralama o hafta kazanılan yıldıza göre yapılır.
- Grup üyelerini arkadaş olarak ekleyebilme.
- D1'de `league_groups` ve `league_memberships` tabloları.
- Cron: Haftalık grup oluşturma (aktif kullanıcıları 30'arlı gruplandırma).
- İlk N haftalık sıralama geçmişi olduğunda, benzer seviyedeki oyuncuları eşleştirme (skill-based matchmaking).

**Çıktı:** Lig sistemi çalışır durumda.

---

## Faz 15 — Frontend: Lig Sayfası *(Gelecek)*

**Ne yapılacak:** Haftalık lig grubunun gösterildiği sayfa.

**Detaylar:**

- 30 kişilik grubun sıralaması.
- Zamanlayıcı: "Haftanın bitmesine X gün Y saat kaldı."
- Grup üyelerini arkadaş olarak ekleme butonu.

**Çıktı:** Lig sayfası çalışır durumda.

---

## 🚀 Başlangıç Stratejisi

**İlk hedef:** Faz 1 → 2 → 3 → 4 → 5 → 6 sırasıyla backend'i tamamen ayağa kaldırmak.

Bu 6 faz tamamlandığında:
- ✅ Veri toplanıyor (her level tamamlamada D1'e yazılıyor)
- ✅ Tüm leaderboard sorguları çalışıyor (API ready)
- ✅ curl/Postman ile test edilebilir
- ✅ Frontend'e hazır

Sonra Faz 7-8 (rozetler), Faz 9-10 (arkadaşlar), ve son olarak Faz 11-13 (frontend) devreye alınır.
Faz 14-15 (ligler) uzun vadeli hedef olarak planlanır.

> [!TIP]
> **İlk ajana verilecek görev:** Faz 1 — D1 migration dosyası. Bu, tüm sistemin temeli.
