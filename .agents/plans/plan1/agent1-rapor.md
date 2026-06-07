# 📋 Faz 1 Raporu: D1 Veritabanı Şeması ve Güvenlik Sıkılaştırması

Bu rapor, Liderlik Tabloları (Leaderboards), Rozetler (Badges) ve Arkadaşlık Sistemi (Friendships) güncellemesinin **Faz 1 (D1 Veritabanı Şeması)** aşamasında tamamlanan işleri, güvenlik yapılandırmalarını ve Faz 2 için gerekli teknik detayları içermektedir.

---

## 🛠️ Tamamlanan Çalışmalar ve Dosyalar

* **Oluşturulan Migration Dosyası:** [`0002_leaderboard.sql`](file:///c:/Users/ahmet/Desktop/Projects/myReactApps/know-and-conquer/syncron-worker/migrations/0002_leaderboard.sql)
* **Kapsam:** Yol haritasında belirtilen 6 temel veritabanı tablosu, gerekli tüm indeksler ve üst düzey güvenlik kısıtlamaları oluşturuldu.
* **Worker Kod Durumu:** Yol haritası direktifleri doğrultusunda bu fazda **hiçbir worker uygulama kodu değiştirilmedi**, sadece SQL şeması hazırlandı ve yerel olarak test edildi.

---

## 🗄️ Oluşturulan Tablolar ve Şema Yapısı

### 1. `user_profiles`
Firestore verilerinden denormalize edilen kullanıcı bilgilerini (displayName, tag) saklayan cache tablosudur. Leaderboard sorgularının Firestore'a gitmeden hızlıca kullanıcı adı göstermesini sağlar.
* **Güvenlik Önlemi:** `uid` (1-128 karakter) ve `display_name` (1-100 karakter) için uzunluk sınırları eklendi. Benzersiz `tag` alanı 2-20 karakter arasına sınırlandı.

### 2. `user_period_scores`
Kullanıcıların dönemlik yıldız kazançlarını (`stars_gained`) ve tamamladıkları seviye sayılarını (`levels_done`) tutar.
* **Dönemler:** `daily`, `weekly`, `monthly`, `all_time` enum değerleri ile sınırlandırıldı.
* **Güvenlik Önlemi:** `period_type` ile `period_id` formatının eşleşmesini zorunlu kılan çapraz kolon `CHECK` kısıtı (SQLite `GLOB` desenleri ile) yazıldı. `stars_gained` ve `levels_done` değerlerinin negatif olması engellendi.

### 3. `user_world_records`
Kullanıcıların elinde tuttukları aktif dünya rekorlarını ve dönem içinde kırdıkları yeni rekor sayılarını takip eder.
* **Dönemler:** `daily`, `weekly`, `all_time` olarak sınırlandırıldı.
* **Güvenlik Önlemi:** `records_count` sayacının negatif olması engellendi (`records_count >= 0`). Bu sayede Faz 4'teki rekor devretme/eksiltme mantığındaki olası bug'lar veritabanı düzeyinde engellenmiştir.

### 4. `creator_scores`
Topluluk seviyesi yaratıcılarının puanlarını (tamamlanma sayıları ve kazandırdıkları toplam yıldız) saklar.
* **Dönemler:** `monthly`, `all_time` olarak sınırlandırıldı.
* **Güvenlik Önlemi:** Sayaçların negatif olması engellendi ve aylık periyot formatı zorunlu kılındı.

### 5. `badges`
Kullanıcılara otomatik cron job (Faz 7) ile dağıtılacak rozetleri tutar.
* **Güvenlik Önlemi:** `rank` (sıralama) değeri 1 ile 10 arasında sınırlandırıldı (`rank BETWEEN 1 AND 10`). `(uid, badge_type, period_id)` kolon grubu üzerinde **Unique Index** oluşturularak mükerrer rozet dağıtımı engellendi (idempotency garantisi).

### 6. `friendships`
Kullanıcılar arasındaki simetrik arkadaşlık ilişkilerini tutar.
* **Durumlar:** `pending`, `accepted`, `blocked` ile sınırlandırıldı.
* **Güvenlik Önlemi:** `user_a < user_b` kanonik sıralama kuralı zorunlu kılınarak mükerrer çiftlerin kaydedilmesi ve kullanıcının kendi kendisiyle arkadaş olması engellendi. Arkadaşlık isteğini gönderen `requested_by` değerinin sadece `user_a` veya `user_b` olabileceği kontrol edilerek üçüncü tarafların istek manipülasyonu yapması engellendi.

---

## 🛡️ Güvenlik Sıkılaştırması (Security Hardening) Detayları

Olası tüm veri manipülasyonu, DoS (hizmet dışı bırakma) ve veri zehirlenmesi saldırılarına karşı SQLite üzerinde şu kısıtlamalar (`CHECK constraints`) aktifleştirilmiştir:

1. **Uzunluk Sınırları (Payload Flooding Koruması):** Tüm `TEXT` tipindeki girdiler için UI ve Firebase limitleriyle uyumlu alt/üst sınır belirlemeleri yapıldı.
2. **Dönem Format Validasyonu (Data Poisoning Koruması):**
   * Günlük dönem ID formatı: `YYYY-MM-DD` (Örn: `2026-06-07`)
   * Haftalık dönem ID formatı: `YYYY-WNN` (Örn: `2026-W23`)
   * Aylık dönem ID formatı: `YYYY-MM` (Örn: `2026-06`)
   * Genel dönem ID formatı: `all_time`
3. **Sayaç Taşması/Negatif Değer Koruması:** `stars_gained`, `levels_done`, `records_count`, `plays_gained` sayaçlarının sıfırın altına inmesi veritabanı seviyesinde engellendi.
4. **Rozet Çiftleme Koruması:** Cron hatalarında dahi aynı dönemde aynı rozetin aynı kullanıcıya birden fazla verilmesini engelleyen benzersiz kısıtlama indeksi eklendi.
5. **Arkadaşlık İstekleri Güvenliği:** Sadece taraflardan birinin arkadaşlık isteği başlatabilmesini ve kanonik sıralama ile veri tutarlılığını garanti eden kurallar eklendi.

---

## 🧪 Test ve Doğrulama Sonuçları

Yerel ortamda (Local D1 Emulator) yapılan testlerde:
* `0001_initial.sql` ve `0002_leaderboard.sql` migration'larının temiz bir şekilde uygulandığı doğrulandı.
* **Doğrulama Senaryoları (10/10 BAŞARILI):** 
  * Negatif skor/sayaç ekleme girişimleri veritabanı tarafından **reddedildi**.
  * Hatalı dönem ID formatları (örn. haftalık dönemde `2026-06-07` yazılması) veritabanı tarafından **reddedildi**.
  * Aşırı uzun UID ve display_name değerleri veritabanı tarafından **reddedildi**.
  * `user_a >= user_b` veya geçersiz `requested_by` içeren arkadaşlık kayıtları veritabanı tarafından **reddedildi**.
  * Aynı dönem için aynı kullanıcıya mükerrer rozet ekleme denemesi benzersiz indeks hatasıyla **engellendi**.
  * Geçerli verilerin tamamı tablolara başarıyla yazılabildi.
* Testler tamamlandıktan sonra yerel D1 veritabanı temizlendi ve sıfırdan migration'lar uygulanarak temiz durumda bırakıldı.

---

## 📌 LEADER Agent ve Sonraki Adımlar İçin Notlar

1. **Wrangler Çalıştırma Notu (Windows Ortamı):**
   Windows PowerShell Execution Policy kısıtlamaları nedeniyle doğrudan `npx wrangler` komutu hata verebilir. Yerel işlemlerde ve deploy işlemlerinde wrangler'ı doğrudan Node.js üzerinden çalıştırmak daha kararlıdır:
   ```powershell
   node node_modules\wrangler\bin\wrangler.js d1 migrations apply AUDIT_DB --local
   ```
2. **D1 Veritabanı Yapılandırması:**
   * **Database Binding Adı:** `AUDIT_DB`
   * **Database ID:** `81a86126-95ec-4268-8eb9-e90ac71bab94`
3. **Canlı Ortama Migration Uygulama (Üretim Ortamı):**
   Faz 2'ye geçmeden önce, canlı veritabanı şemasının güncellenmesi için aşağıdaki komut çalıştırılmalıdır (kullanıcı onayı gereklidir):
   ```powershell
   node node_modules\wrangler\bin\wrangler.js d1 migrations apply AUDIT_DB
   ```
4. **Faz 2 İçin Yol Haritası Önerisi:**
   Faz 2'de `complete-level` API route'unun D1 entegrasyonu yapılacaktır. `user_period_scores` tablosuna UPSERT işlemi için `syncron-worker/src/services/leaderboard.ts` servisinde dönem ID'lerini (gün, hafta, ay) dinamik üreten bir fonksiyon yazılmalıdır.
