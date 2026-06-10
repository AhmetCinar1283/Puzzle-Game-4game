⚠️ YAPAY ZEKA / CLAUDE CODE İÇİN SİSTEM NOTU (SYSTEM NOTE FOR AI AGENTS)
Bu belge tamamen bir GELECEK PLANLAMASI ve FİKİR HAVUZUDUR. Şu anki aktif kod tabanıyla, mevcut tick motoruyla veya anlık görevlerle HİÇBİR İLGİSİ YOKTUR. Kullanıcı açıkça talep etmedikçe bu özellikler için kod üretmeye çalışmayın, mimariyi buna göre değiştirmeyin veya mevcut bug'ları çözerken bu dosyayı referans almayın. Bu dosyayı şimdilik tamamen görmezden gelin.

# Syncron - Gelecek Vizyonu ve Yeni Mekanik Fikirleri

### 1. Zemin ve Çevre Etkileşimleri (CELL_BEHAVIORS)
Mevcut CELL_BEHAVIORS registry sistemine eklenebilecek yeni hücre tipleri:

- Kırılgan Zeminler (Crumbling Floors): Üzerinden bir kez geçildiğinde normal davranan, ancak nesne ayrıldıktan sonra yok olup lava veya geçilemez obstacle hücresine dönüşen zeminler. Oyuncuyu rotasını geri dönüşsüz planlamaya iter.
- Baskı Plakaları ve Kilitli Kapılar (Pressure Plates): Mevcut powerSystem.ts altyapısı kullanılarak yapılabilecek mekanizma. Bir nesne veya kutu plakanın üzerindeyken haritanın başka bir yerindeki engeller (kapılar) açılır.
- Yön Saptırıcılar (Rotators): conveyor sisteminden farklı olarak nesnenin hareketini değil, içsel yön algısını değiştiren zeminler. Örneğin bu zemin türüne giren bir nesne için "Yukarı" ok tuşu artık "Sağ" yönünde tepki verir.
- [x] Multi-Conveyor: İkili ya da daha fazla kare ittiren conveyorlar, Bir engel çıkmadığı sürece ve geçtiği kareleri de tetikleyerek n sayıda kare ittiren conveyorler. (Mevcut conveyorlere gelen bir özellik olsa daha güzel olur. Kaç n ittireceğini göstermeli üzerinde)
- [x] Mancınıklar ya da yaylı zıplatıcılar: Conveyorler gibi n sayıda kare ileriye götürecek fakat yukarıdan götürecek. Bu da eğer ice varsa başka yönde ittiren conveyor ya da obstacle'lardan etkilenmeden yani aradaki karelerden etkilenmeden yukarıdan götürecek.

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
- Kırılgan Kutular (Fragile Boxes): BoxState içerisine eklenecek bir dayanıklılık (durability) verisiyle çalışan mekanik. Belli bir sayıda kez itilebilen, daha fazla ittirilmeye çalışıldığında kırılan kutular.


### 5. Oynanış
- **Zaman Yankısı (Time Echoes):** Oyuncu bir seviyede "Kayıt (Record)" tuşuna basar, 5 hamle yapar. Sonra başa döner. O ilk yaptığı 5 hamle "Hayalet" bir kopya tarafından haritada tekrar edilirken, oyuncu o hayaletin açtığı yolları kullanarak asıl karakteriyle başka bir hedefe ilerler.
- **Öklidyen Olmayan Uzay (Non-Euclidean Grid):** Oyundaki Fog of War (Savaş Sisi) ile birleştiğinde o kozmik korku ve bilinmezlik hissiyatını arşa çıkaracak bir harita yapısı. Haritanın sağ kenarından çıkan bir nesne sol kenardan değil, haritanın tam ortasındaki alakasız bir yönden çıkabilir. Uzayın katlandığı, yön algısının bozulduğu ve oyuncunun ezberden çıkıp haritayı deneyimleyerek haritalandırması gerektiği alanlar eklenebilir.
- **Kısıtlı Enerji Havuzu ve Şarj Hücreleri:** Nesnelere sadece bir "mass" değil, kısıtlı bir "pil/enerji" değeri verilebilir. Hareket etmek, ağır bir kutuyu itmek ekstra enerji tüketir. Haritada sadece belirli noktalarda "Şarj İstasyonları" olur. Bu durum, bulmacaya rotayı bulmanın yanı sıra, bir ekonomi ve kaynak yönetimi planlaması yapmayı da zorunlu kılar.
- **Kuantum Dolanıklığı (Quantum Entanglement):** Kuantum bağı (Tether) fikrine çok benzer ama daha karmaşığı. Haritanın farklı yerlerindeki iki nesne "dolanık" hale gelir. Oyuncu birinci nesneyi sağa ittiğinde, haritanın diğer ucundaki ikinci nesne de fiziksel bir etki olmamasına rağmen istemsizce sağa kayar (veya ayna simetrisiyle sola kayar). Birbirinden bağımsız iki haritada (Dual Maps) tam bir senkronizasyon bulmacası yaratır.
- **Ağırlık ve Denge Plakaları:** Tek bir nesnenin basmasının yetmediği devasa mekanizmalar. Bir kapının açılması için "Ağırlık = 5" gerekiyordur. Oyuncu oraya bir normal kutu (mass: 1) ve bir de ağır kasa (mass: 4) itip üst üste veya yan yana bindirdiğinde anca o mekanizmayı tetikleyebilir.