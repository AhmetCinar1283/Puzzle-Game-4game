# Syncron - Çevrimiçi (Online) Oynanış Fikirleri

Bu belgede, Syncron oyununu arkadaşlarla veya rastgele oyuncularla online oynamayı sağlayacak oyun modları ve mekanik taslakları yer almaktadır.

---

### 1. Eş Zamanlı Yarış ve Sabotaj Modu (Versus / Ghost Race)
* **Konsept:** İki oyuncu aynı anda aynı bulmacayı çözmeye çalışır.
* **Mekanikler:**
  * Ekran ikiye bölünür (split-screen) ya da rakibin hareketleri yarı şeffaf bir "Hayalet" (Ghost) olarak oyuncunun kendi ekranında görünür.
  * Seviyeyi en az hamlede veya en kısa sürede bitiren kazanır.
  * Haritadaki özel sabotaj butonlarına basarak rakibin ekranına geçici engeller (buz zemin, yönleri ters çevirme, görüşü kapatma vb.) gönderilebilir.

### 2. Ayrık Dünyalar ve Asimetrik Co-op (Connected Grids)
* **Konsept:** Oyuncular birbirine bağlı iki farklı haritada yardımlaşarak ilerler.
* **Mekanikler:**
  * Oyuncu A kendi nesnelerini, Oyuncu B kendi nesnelerini kontrol eder.
  * Bir oyuncunun bastığı buton, diğer oyuncunun haritasındaki kapıyı/engeli açar.
  * Seviyeyi tamamlayan oyuncu, arkadaşının haritasına "Yardımcı Drone" veya enerji göndererek kutuları itmesine yardım edebilir.
  * Ekran üzerinden işaretleme (ping) veya serbest çizim sistemi ile taktik paylaşımı yapılır.

### 3. Sıralı Planlama Modu (Turn-Based Co-op / "Double Move")
* **Konsept:** Tek bir haritada oyuncuların sıra tabanlı işbirliği yapması.
* **Mekanikler:**
  * Oyuncular sırayla hamle yapar (Örn: Oyuncu A 3 hamle yapar, sonra sıra Oyuncu B'ye geçer).
  * Hareketler senkronize olduğu için bir oyuncunun hamlesi diğerinin nesnesini de etkiler.
  * Hamle yapmadan önce "hayali rota çizimi" ile ortak strateji belirlenir.
  * Bulmacayı anlamayan oyuncunun diğerinden taktik öğrenmesini kolaylaştırır.

### 4. Tuzakçı vs. Koşucu (Trapper vs. Runner)
* **Konsept:** Bir oyuncunun haritayı tasarlayıp tuzaklar kurduğu, diğerinin çözmeye çalıştığı asimetrik mod.
* **Mekanikler:**
  * Tuzakçı (Trapper), elindeki bütçe ve cooldown sürelerine göre haritaya gerçek zamanlı olarak buz zemin, conveyor veya yön değiştirici yerleştirir.
  * Koşucu (Runner), bu dinamik tuzaklara rağmen hedefe ulaşmaya çalışır.

### 5. Bölge Sınırı ve Kontrol Alanları (Territorial Co-op)
* **Konsept:** Harita üzerinde oyuncuların hareket alanlarının sınırlandırılması.
* **Mekanikler:**
  * Harita üzerinde belirli sınırlar (bölge çizgileri) bulunur. 
  * Oyuncu A sadece kendi bölgesindeki karolarda hareket edebilir ve nesnesini sokabilir; Oyuncu B ise sadece kendi bölgesinde kalabilir.
  * Sınırların dışına geçiş yasaktır ya da özel şartlara bağlıdır (örneğin anahtar toplama, geçici portal açma veya diğer oyuncunun bir butona basılı tutması).
  * İki nesnenin senkronize hareketiyle sınır çizgilerinden geçişler ve kutu transferleri planlanarak ortak hedeflere ulaşılır.

---

## Teknik Altyapı Notları
* **Lobi Yönetimi:** Firebase Firestore üzerinden `/rooms` koleksiyonu ile oda kodu oluşturma ve lobi yönetimi.
* **Sıralı / Yavaş Modlar için Senkronizasyon:** Firestore `onSnapshot` gerçek zamanlı dinleyicileri (düşük maliyetli ve kolay entegrasyon).
* **Hızlı / Eş Zamanlı Modlar için Senkronizasyon:** Cloudflare Workers + WebSockets (düşük gecikmeli, anlık konum ve hamle iletimi).
