# 📝 Agent 9A — Backend Ban & Block Sistemi Uygulama Raporu

**Tarih:** 2026-06-07  
**Uygulayan:** Agent 9A (Backend)  
**Durum:** Tamamlandı (Tüm testler yeşil - 64/64)

Bu rapor, granüler ban sistemi ve kullanıcı bloklama sisteminin backend tarafındaki uygulamasını özetler. Takımı yöneten ana ajanın veya Agent 9B'nin (Frontend) bu bilgileri kullanarak koordinasyon sağlaması amaçlanmıştır.

---

## 1. Veritabanı Değişiklikleri (D1 Migration)

D1 veritabanı şemasına ban kayıtlarını tutmak üzere yeni bir göç dosyası eklendi:
- **Dosya:** [0004_bans.sql](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/migrations/0004_bans.sql)
- **Eklenen Tablo:** `user_bans`
- **Tasarım Kararı:** SQLite üzerinde indekslerin (`idx_bans_uid_type`) oluşturulmasıyla aktif ban sorguları (`uid`, `ban_type`, `lifted_at`, `expires_at` kolonları üzerinden) optimize edildi. `expires_at` ve `lifted_at` kolonları ISO 8601 UTC tarih formatında tutularak saat dilimi çakışmaları önlendi.

---

## 2. Firestore REST API Yardımcı Metotları

Firestore üzerinde kısmi güncellemeler ve belge silme işlemleri yapabilmek için iki yeni yardımcı metot tanımlandı:
- **Dosya:** [firestore.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/services/firestore.ts)
- **Metotlar:**
  1. `fsPatch`: Gönderilen parametreleri `updateMask.fieldPaths` query parametresi eşliğinde PATCH isteği olarak Firestore REST API'ye iletir (Belgenin tamamını ezmeden sadece belirli alanları günceller).
  2. `fsDelete`: Belirtilen Firestore yolundaki belgeyi siler (DELETE).

---

## 3. Ban Servisi

Ban sorgulama mantığını modülerleştirmek amacıyla yeni bir servis katmanı eklendi:
- **Dosya:** [banService.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/services/banService.ts)
- **Sağlanan Metotlar:**
  - `checkActiveBan(db, uid, banType): Promise<boolean>`: Aktif (süresi dolmamış ve kaldırılmamış) bir ban olup olmadığını sorgular.
  - `getActiveBans(db, uid): Promise<ActiveBan[]>`: Kullanıcının tüm aktif banlarını listeler.
  - `getBanHistory(db, uid): Promise<BanRecord[]>`: Kullanıcının geçmiş ve aktif tüm ban kayıtlarını listeler.

---

## 4. Admin API Endpoint'leri

Admin ban kontrol paneli için `adminApi.ts` dosyasına yetki kontrollü ve doğrulama mekanizmalı 3 yeni route eklendi:
- **Dosya:** [adminApi.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/routes/adminApi.ts)
- **Endpointler:**
  1. `POST /admin/users/:uid/bans` (Yeni ban yayınlama)
     - **Yetki:** Sadece `admin` rolüne sahip kullanıcılar yapabilir.
     - **Gövdeler (Zod):** `{ banType: 'platform'|'tag'|'social'|'coop', reason: string, expiresAt?: string }`
     - **Tag Banı Mantığı:** Tag banı atıldığında:
       - Firestore `users/{uid}` altındaki `tag` alanı `null`, `tagChangeCount` alanı ise `999` olarak güncellenir. `999` değeri Firebase Cloud Function kısıtlamasını tetikleyerek kullanıcının gelecekte tag değiştirmesini engeller (Frontend'e müdahale gerekmez).
       - Firestore `tags/{TAG}` kaydı silinerek tag serbest bırakılır.
       - D1 `user_profiles` cache tablosunda `tag = NULL` yapılır.
       - Tüm bu D1 adımları veri tutarlılığı için **D1 batch transaction** ile atomik olarak gerçekleştirilir.
  2. `POST /admin/users/:uid/bans/:banId/lift` (Ban kaldırma)
     - **Yetki:** Sadece `admin` rolü yapabilir.
     - **Tag Banı Çözme Mantığı:** Eğer kaldırılan ban tipi `tag` ise, Firestore `users/{uid}` altındaki `tagChangeCount` sıfırlanarak (`0`) kullanıcının tekrar tag talep edebilmesi sağlanır.
  3. `GET /admin/users/:uid/bans` (Kullanıcının ban geçmişi)
     - **Yetki:** `admin` ve `moderator` rolleri erişebilir (Salt okunur).
     - **Çıktı:** `{ success: true, bans: BanRecord[], activeBans: ActiveBan[] }`

---

## 5. Kullanıcı-Kullanıcı Engelleme (Block)

Kullanıcıların birbirlerini engellemesi için arkadaşlık sistemine bloklama desteği eklendi:
- **Dosya:** [friends.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/routes/friends.ts)
- **Endpointler:**
  1. `POST /friends/block/:uid` (Birini engelleme)
     - Canonical ordering (`user_a < user_b`) kuralları uygulanır.
     - Mevcut arkadaşlık varsa durumu `blocked` olarak güncellenir ve `requested_by` engelleyen kişi (`uid`) olarak ayarlanır.
  2. `DELETE /friends/block/:uid` (Engeli kaldırma)
     - Sadece engelleyen kişi (`requested_by === uid`) engeli kaldırabilir. Arkadaşlık veritabanından tamamen silinir (`DELETE`).
  3. `GET /friends/blocked` (Engellenenler listesi)
     - Giriş yapan kullanıcının engellediği tüm profilleri D1 cache JOIN'i ile listeler.

---

## 6. Ban Kontrollerinin Dağıtık Entegrasyonu

Performansı optimize etmek amacıyla platform ban kontrolü global middleware yerine sadece kritik noktalara entegre edildi:
- **Platform Ban:** [game.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/routes/game.ts) - `POST /complete-level` handler'ında kontrol edilir. Banlı ise `403 Forbidden` döner.
- **Sosyal Ban:** [friends.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/src/routes/friends.ts) - `POST /friends/request` handler'ında kontrol edilir. Banlı ise `403 Forbidden` döner.

---

## 7. Doğrulama ve Test Sonuçları

Vitest pool workers ortamına yeni entegre edilen ban ve block özellikleri için 4 adet kapsamlı test senaryosu eklendi:
- **Dosya:** [friendsApi.spec.ts](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/test/friendsApi.spec.ts)
- **Senaryolar:**
  - Aktif sosyal banı olan kullanıcının arkadaşlık isteği atmasının 403 ile engellenmesi.
  - Bir kullanıcının engellenmesi ve veritabanı kısıtlarının doğrulanması.
  - Engelin başarıyla kaldırılması.
  - Engellenen kullanıcılar listesinin doğru profillerle getirilmesi.
- **Sonuç:** `npm run test` komutu başarıyla çalıştırılmış ve **64 testin tamamı (64/64) başarıyla yeşil geçmiştir.**

---

## 💡 Agent 9B (Frontend) İçin Yönlendirmeler

Agent 9B frontend tarafında UI geliştirmesi yaparken aşağıdaki yeni API endpoint'lerini kullanabilir:

1. **Kullanıcı Ban Geçmişini Çekme:**  
   `GET /admin/users/:uid/bans` (Headers: Admin JWT `Authorization: Bearer <token>`)  
   Dönen veri: `{ success: true, bans: [...], activeBans: [...] }`

2. **Yeni Ban Tanımlama:**  
   `POST /admin/users/:uid/bans` (Headers: Admin JWT `Authorization: Bearer <token>`)  
   Gönderilen veri: `{ banType: 'platform' | 'tag' | 'social' | 'coop', reason: string, expiresAt?: string }`

3. **Aktif Banı Kaldırma (Lift):**  
   `POST /admin/users/:uid/bans/:banId/lift` (Headers: Admin JWT `Authorization: Bearer <token>`)

4. **Kullanıcı Engelleme:**  
   `POST /friends/block/:uid` (Headers: Kullanıcı JWT `Authorization: Bearer <token>`)

5. **Kullanıcı Engeli Kaldırma:**  
   `DELETE /friends/block/:uid` (Headers: Kullanıcı JWT `Authorization: Bearer <token>`)

6. **Engellenenler Listesi:**  
   `GET /friends/blocked` (Headers: Kullanıcı JWT `Authorization: Bearer <token>`)  
   Dönen veri: `{ success: true, blocked: [{ uid, displayName, tag, showcaseBadges }] }`
