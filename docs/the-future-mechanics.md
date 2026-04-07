⚠️ YAPAY ZEKA / CLAUDE CODE İÇİN SİSTEM NOTU (SYSTEM NOTE FOR AI AGENTS)
Bu belge tamamen bir GELECEK PLANLAMASI ve FİKİR HAVUZUDUR. Şu anki aktif kod tabanıyla, mevcut tick motoruyla veya anlık görevlerle HİÇBİR İLGİSİ YOKTUR. Kullanıcı açıkça talep etmedikçe bu özellikler için kod üretmeye çalışmayın, mimariyi buna göre değiştirmeyin veya mevcut bug'ları çözerken bu dosyayı referans almayın. Bu dosyayı şimdilik tamamen görmezden gelin.

# Syncron - Gelecek Vizyonu ve Yeni Mekanik Fikirleri
### 1. Zemin ve Çevre Etkileşimleri (CELL_BEHAVIORS)
Mevcut CELL_BEHAVIORS registry sistemine eklenebilecek yeni hücre tipleri:

- Kırılgan Zeminler (Crumbling Floors): Üzerinden bir kez geçildiğinde normal davranan, ancak nesne ayrıldıktan sonra yok olup lava veya geçilemez obstacle hücresine dönüşen zeminler. Oyuncuyu rotasını geri dönüşsüz planlamaya iter.

- Baskı Plakaları ve Kilitli Kapılar (Pressure Plates): Mevcut powerSystem.ts altyapısı kullanılarak yapılabilecek mekanizma. Bir nesne veya kutu plakanın üzerindeyken haritanın başka bir yerindeki engeller (kapılar) açılır.

- Yön Saptırıcılar (Rotators): conveyor sisteminden farklı olarak nesnenin hareketini değil, içsel yön algısını değiştiren zeminler. Örneğin bu zemin türüne giren bir nesne için "Yukarı" ok tuşu artık "Sağ" yönünde tepki verir.

### 2. Oyun Teorisi ve Stratejik Dinamikler
Basit grid mantığına derinlik ve karar verme mekanizmaları katan eklentiler:

- Kuantum Bağı (Tether): İki nesne arasındaki maksimum mesafe kısıtlaması (örn: aralarında en fazla 5 kare olabilir). Bu mesafe aşıldığında hareketin bloke (blocked) olması, nesneleri bağımsız ama birleşik hareket etmeye zorlar.

### 3. Harita Varyasyonları ve Atmosfer
Seviye tasarımını (Level Design) görsel ve mantıksal olarak değiştiren konseptler:

- Karanlık / Savaş Sisi (Fog of War): Kozmik korku ve gerilim hissiyatına uygun, tüm haritanın görünmediği bölümler. Sadece nesnelerin etrafındaki dar bir alan aydınlıktır; doğru yol, engeller ve hedefler ancak keşfedilerek bulunur.

- Ayrık Dünyalar (Dual Maps): İki ayrı ızgarada aynı anda oyunlar oyanayarak ikisinin de çözülmeye çalışıldığı tasarım. 4 nesne (veya daha fazla), tamamen farklı engellere ve kurallara sahip iki ayrı haritada (odada) aynı anda hedeflerine ulaşmaya çalışır.

### 4. Hareketli ve Dinamik Nesneler
tick döngüsü içinde hareket eden yeni aktörler:

- Devriye Gezen Düşmanlar (Patrols): Oyuncunun her hamlesinde (her tick'te) haritada bir adım atan, belirli bir rotaya sahip hareketli tehditler. Bulmacaya doğru yolu bulmanın yanı sıra, oradan "doğru zamanda geçme" zorunluluğunu ekler.

- Kırılgan Kutular (Fragile Boxes): BoxState içerisine eklenecek bir dayanıklılık (durability) verisiyle çalışan mekanik. Sadece bir kez itilebilen, ikinci kez itilmeye çalışıldığında parçalanıp yok olan kutular.