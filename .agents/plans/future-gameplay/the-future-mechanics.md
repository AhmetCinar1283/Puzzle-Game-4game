⚠️ YAPAY ZEKA / CLAUDE CODE İÇİN SİSTEM NOTU (SYSTEM NOTE FOR AI AGENTS)
Bu belge tamamen bir GELECEK PLANLAMASI ve FİKİR HAVUZUDUR. Şu anki aktif kod tabanıyla, mevcut tick motoruyla veya anlık görevlerle HİÇBİR İLGİSİ YOKTUR. Kullanıcı açıkça talep etmedikçe bu özellikler için kod üretmeye çalışmayın, mimariyi buna göre değiştirmeyin veya mevcut bug'ları çözerken bu dosyayı referans almayın. Bu dosyayı şimdilik tamamen görmezden gelin.

# Syncron - Gelecek Vizyonu ve Yeni Mekanik Fikirleri

---

## 📊 Zorluk Derecesi Özet Tablosu

Aşağıdaki özellikler yapım kolaylığına göre gruplandırılmıştır:

| Zorluk Seviyesi | Özellikler |
| :--- | :--- |
| **🟢 Kolay** | - Kırılgan Zeminler veya dönüşen hücreler<br>- Yön Saptırıcılar (Rotators)<br>- Faz Kapıları ve Renk Filtreleri (Color/Phase Gates)<br>- Karanlık / Savaş Sisi (Fog of War)<br>- Kırılgan Kutular (Fragile Boxes)<br>- Kısıtlı Enerji Havuzu ve Şarj Hücreleri<br>- Bölge Sınırı |
| **🟡 Orta** | - Baskı Plakaları ve Kilitli Kapılar (Pressure Plates)<br>- Multi-Conveyor `[x]` *(Tamamlandı)*<br>- Mancınıklar ya da yaylı zıplatıcılar `[x]` *(Tamamlandı)*<br>- Player Switch<br>- Ghost<br>- Buton / Plakalar<br>- Balçık / Çamur Hücreleri (Slime/Sticky)<br>- Devriye Gezen Düşmanlar (Patrols)<br>- Hücre Kabukları |
| **🔴 Zor** | - Manyetik Kutuplar ve Uzaktan Çekim (Magnetism)<br>- Işık Yansıtma ve Aynalar (Light & Reflectors)<br>- Mantık Kapıları ve Devreler (Logic Grid)<br>- Kuantum Bağı (Tether)<br>- Ayrık Dünyalar (Dual Maps) `[x]` *(Tamamlandı)*<br>- Paralel Evrenler<br>- Gökdelenler<br>- Zaman Yankısı (Time Echoes)<br>- Zaman Kırılması<br>- Öklidyen Olmayan Uzay (Non-Euclidean Grid)<br>- Kuantum Dolanıklığı (Quantum Entanglement)<br>- Designer<br>- Zaman Makinesi<br>- Zaman Taneleri |
| **🔥 Çok Zor** | - TENET (Zaman evrilmesi ve retrocausal oynanış) |

---

### 1. Zemin ve Çevre Etkileşimleri (CELL_BEHAVIORS)
Mevcut CELL_BEHAVIORS registry sistemine eklenebilecek yeni hücre tipleri:

- [ ] **🟢 Kırılgan Zeminler veya dönüşen hücreler:** 
  - Üzerinden bir kez geçildiğinde normal davranan, ancak nesne ayrıldıktan sonra yok olup lava veya geçilemez obstacle hücresine veya boşluğa dönüşen zeminler.
  - Oyuncuyu rotasını geri dönüşsüz planlamaya iter. 
- **🟡 Baskı Plakaları ve Kilitli Kapılar (Pressure Plates):** 
  - Bir nesne veya kutu plakanın üzerindeyken haritanın başka bir yerindeki engeller kapılar açılabilir, playerlerin yönleri değişebilir, belli renge özel etkileşimli nesnelerin rengini değiştirebilir.
  - Basıldığında direkt olabilir ya da basılı tutulmak zorunda kalabilir.
- [ ] **🟢 Yön Saptırıcılar (Rotators):** 
  - toggle sisteminden farklı olarak nesnenin hareketini değil, içsel yön algısını değiştiren zeminler. Örneğin bu zemin türüne giren bir nesne için "Yukarı" ok tuşu artık "Sağ" yönünde tepki verir.
  - Biraz sinir bozucu olabilir
- [x] **🟡 Multi-Conveyor:** 
  - İkili ya da daha fazla kare ittiren conveyorlar, Bir engel çıkmadığı sürece ve geçtiği kareleri de tetikleyerek n sayıda kare ittiren conveyorler.
- [x] **🟡 Mancınıklar ya da yaylı zıplatıcılar:** 
  - Conveyorler gibi n sayıda kare ileriye götürecek fakat yukarıdan götürecek. Bu da eğer ice varsa başka yönde ittiren conveyor ya da obstacle'lardan etkilenmeden yani aradaki karelerden etkilenmeden yukarıdan götürecek.
- [ ] **🟡 Player Switch:** 
  - Playerlerin yerlerini değiştiren kareler. Bir player bir kareye gelince ya da iki player de o tip kareye gelince yer değiştirirler.
  - Sadece player değil orada ki herhangi iki nesne de ışınlanabilir de olabilir.
- [ ] **🟡 Ghost:** 
  - Hayalete dönüşme. Bir kareye gelen nesneler hayalete dönüşür ve obstacle gibi engellerden geçer ve tetikleyicileri aktif etmez (conveyor, trambolin gibi teleportler'lardan geçebilir mi karar verilecek)
- [ ] **🟡 Buton / Plakalar:**
  - Üzerinde bir nesne varken bir şeyi tetikler.
  - Üzerindeki nesneyenin ağırlığına göre kuvvet de uygulayabilir. Yani nesnenin ağırlığı yetmezse buton tıklanmayabilir.
- [ ] **🟡 Balçık / Çamur Hücreleri (Slime/Sticky - Asenkron Yaratıcı):**
  - Buzun tersi. Buraya basan nesne bir sonraki hamlesini 2 tick'te yapar. İki oyuncunun senkronizasyon adımlarını (faz farkını) bilerek kaydırmak için kullanılır.
- [ ] **🔴 Manyetik Kutuplar ve Uzaktan Çekim (Magnetism):**
  - "+" ve "-" kutuplu nesneler/zeminler. Oyuncu elektrik yüklenirse (Power) metal kutuları uzaktan çekebilir veya itebilir.
- [x] **🟢 Faz Kapıları ve Renk Filtreleri (Color/Phase Gates):**
  - Sadece kendi rengindeki player karakterinin geçebileceği veya etkileşebileceği renkli lazerler/engeller. (box)
- [ ] **🔴 Işık Yansıtma ve Aynalar (Light & Reflectors):**
  - Oyuncuların ayna kutularını iterek lazer ışınlarını yönlendirip alıcılara ulaştırarak kapıları açtığı Sokoban + Optik bulmacaları.
- [ ] **🔴 Mantık Kapıları ve Devreler (Logic Grid):**
  - Zemin üzerinde VE (AND), VEYA (OR), DEĞİL (NOT) mantıksal kapıları. İz bırakma (trail) sistemi ile birleşerek dinamik elektrik devreleri kurdurur.

### 2. Stratejik Dinamikler
Basit grid mantığına derinlik ve karar verme mekanizmaları katan eklentiler:

- [ ] **🔴 Kuantum Bağı (Tether):** 
  - İki nesne arasındaki maksimum mesafe kısıtlaması (örn: aralarında en fazla 5 kare olabilir). Bu mesafe aşıldığında hareketin bloke (blocked) olması.
  - Nesneleri bağımsız ama birleşik hareket etmeye zorlar.

### 3. Harita Varyasyonları ve Atmosfer
Seviye tasarımını (Level Design) görsel ve mantıksal olarak değiştiren konseptler:

- [x] **🟢 Karanlık / Savaş Sisi (Fog of War):** 
  - Kozmik korku ve gerilim hissiyatına uygun, tüm haritanın görünmediği bölümler. 
  - Sadece nesnelerin etrafındaki dar bir alan aydınlıktır; doğru yol, engeller ve hedefler ancak keşfedilerek bulunur.
- [x] **🔴 Ayrık Dünyalar (Dual Maps):** 
  - İki ayrı ızgarada aynı anda oyunlar oyanayarak ikisinin de çözülmeye çalışıldığı tasarım. Aynı anda veya seçilerek sırayla haritalar çözülüyor.
- [ ] **🔴 Paralel Evrenler:** 
  - Farklı boyutlara gitmek. Player başka bir boyuta geçer, orada resmen farklı bir harita vardır.
  - Sadece player ya da tüm nesneler; bir hücre tipine geldiğinde, bir hücre tipine geldiğinde veya oyun başladıklarında sahip olduğu özellik sayesinde bir tuşa basark gidip gelme ile de tetiklenebilir. 
  - Tüm palel evrendeki nesneler aynı anda mı kontrol edilecek yoksa sırayla mı (bence ayrı olsun çok katlı harita da bunun aynı andalısı olabilir)
- [ ] **🔴 Gökdelenler:** 
  - Nesnelerin bulunduğu haritada üst ve alt kat gibi şeyler olacak. Cisimler yukarı çıkan emrdiven ya da asansörler ile hareket edebilecek.

### 4. Hareketli ve Dinamik Nesneler
tick döngüsü içinde hareket eden yeni aktörler:

- [ ] **🟡 Devriye Gezen Düşmanlar (Patrols):** 
  - Oyuncunun her hamlesinde (her tick'te) haritada bir adım atan, belirli bir rotaya sahip hareketli tehditler.
  - Bulmacaya doğru yolu bulmanın yanı sıra, oradan "doğru zamanda geçme" zorunluluğunu ekler.
- [x] **🟢 Kırılgan Kutular (Fragile Boxes):** 
  - BoxState içerisine eklenecek bir dayanıklılık (durability) verisiyle çalışan mekanik. Belli bir sayıda kez itilebilen, daha fazla ittirilmeye çalışıldığında kırılan kutular.

### 5. Oynanış
- [ ] **🔴 Zaman Yankısı (Time Echoes):** 
  - Oyuncu bir seviyede "Kayıt (Record)" tuşuna basar, 5 hamle yapar. Sonra başa döner. O ilk yaptığı 5 hamle "Hayalet" bir kopya tarafından haritada tekrar edilirken, oyuncu o hayaletin açtığı yolları kullanarak asıl karakteriyle başka bir hedefe ilerler.
- [ ] **🔴 Zaman Kırılması:**
  - Zaman yankısı gibi çalışıyor fakat sürekli o kaydı tekrar eden bir şey yok. Player bir kareye geliyor ya da tuş ile başlatılıyor. n hamle oynanıyor ve ardından (belki n hamle sonra otomatik belki bir tuş ile) n hamle geçmişe gidiliyor.
- [ ] **🔴 Öklidyen Olmayan Uzay (Non-Euclidean Grid):** 
  - Haritanın sağ kenarından çıkan bir nesne sol kenardan değil, haritanın tam ortasındaki alakasız bir yönden ya da kenardan çıkabilir.
  - Uzayın katlandığı, yön algısının bozulduğu ve oyuncunun ezberden çıkıp haritayı deneyimleyerek haritalandırması gerektiği alanlar eklenebilir.
- [ ] **🟢 Kısıtlı Enerji Havuzu ve Şarj Hücreleri:** 
  - Nesnelere sadece bir "mass" değil, kısıtlı bir "pil/enerji" değeri verilebilir. Hareket etmek, ağır bir kutuyu itmek ekstra enerji tüketir. Haritada sadece belirli noktalarda "Şarj İstasyonları" olur. Bu durum, bulmacaya rotayı bulmanın yanı sıra, bir ekonomi ve kaynak yönetimi planlaması yapmayı da zorunlu kılar.
- [ ] **🔴 Kuantum Dolanıklığı (Quantum Entanglement):** 
  - Kuantum bağı (Tether) fikrine çok benzer. Haritanın farklı yerlerindeki iki nesne "dolanık" hale gelir. Oyuncu birinci nesneyi sağa ittiğinde, haritanın diğer ucundaki ikinci nesne de fiziksel bir etki olmamasına rağmen istemsizce sağa kayar (veya ayna simetrisiyle sola kayar). 
  - Birbirinden bağımsız iki haritada (Dual Maps) tam bir senkronizasyon bulmacası yaratır.
- [ ] **🟡 Hücre Kabukları:**
  - Bir şeylerle tetiklenerek (elektrik, plaka) o hücrenin asıl kendisini ortaya çıkartır. Kapalı durumdayken normal hücreye dönüştürür orayı.
- [ ] **🟢 Bölge Sınırı:**
  - player veya nesnelerin bölgeleri vardır. O bölgeden çıkamazlar. (duvar gibi ittirilemez de olabilir lav da)
  - Belki ortak bölge de olur herkesin girebildiği.
- [ ] **🔴 Designer:**
  - Oynayan kişi bazı kareleri söküp taşıyabilir ya da elinde ona verilen kareleri istediği yere yerleştirebilir haritada.
- [ ] **🔥 TENET:** Bu özellik iki farklı şekilde olabilir;
  - 1. Oyunun sonlarında geriye doğru hareket eden evritilmiş playerler olur ve onlar için kapıyı açar veya düğmeye basar. Oyuncu hiç evritilmiş playeri felan oynamaz.
  - 2. Oyuncu ilk başta belli hamlesi vardır (n hamle diyelim), geçmişteki kendisi için kapıları açar anahtarları yerleştirir gözcülerin dikkatini dağıtır: O hamlelerden sonra oyun başlar ve puzzle'ın son n hamlesine geldiğinde o player ortaya çıkar ve yine o şeyleri kendiliğinden yapar ve oyun çözülür.
  - Her iki seçenek de teknik açıdan zor ve oyuna katısı açısından endişeliyim ama beni çok heyecanlandırdı tutturursak güzel tutttururuz.
- [ ] **🔴 Zaman Makinesi:**
  - Evriltmer makinaları vardır, player onun içine girdiğinde tıkladığı sayı kadar dışarısı geçmişe doğru gider, çıktığında yine zaman doğru akar.
- [ ] **🔴 Zaman Taneleri:**
  - Oyuncu gideceği yeri parça parça oynar.
  - Diyelim 12 hamlelik bir çözüm. Oyuncu 8. hamlelik yerden başlar 12ye gelmeye çalışır, 12ye gelince 4. hamleden 8'e ve en son en başa gelir ve 4. hamlede olması gereken yere gelir. Arada fazla hamle olabilir
  - Bu biraz garip geldi bana bir zorluk yaratır mı bilemedim. eksisi artısından çok gibi çünkü zor kodlanır

### 6. İleride eklenebilecek 

### 7. Yapay Zekadan Gelen Efsanevi Öneriler