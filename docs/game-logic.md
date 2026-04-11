# Syncron - Oyun Mekanikleri ve Kuralları (GDD)

## 1. Hücre Tipleri ve Temel Etkileşimler (Cell Behaviors)

Haritadaki her zemin türü, üzerine gelen nesnelere (oyuncu veya kutu) farklı fiziksel kurallar uygular:

| Hücre Tipi              | Davranış ve Kural |
|------------------------|-------------------|
| empty (Boş)            | Üzerinden geçilebilir normal zemin. Sürtünmeli |
| obstacle (Engel)       | Geçilemez kaskatı duvar. Hareketi engeller. Buraya gelinemez, Trambolinle felan düşerse bir cisim kırılır |
| forbidden (Yasaklı)    | Bu kareye gelen nesne kırılır yok olur. |
| target_1 / target_2    | Oyuncuların ulaşması gereken bitiş/kazanma noktaları. |
| direction_toggle       | Üzerine basan nesnenin hareket algısını tersine çevirir (Normal ↔ Ters Yön). |
| ice (Buz)              | Sürtünmesiz alan. Gelen nesne hızını kaybetmez geldiği yönde kaymaya devam eder. |
| power_node (Güç Noktası) | Üzerine basan oyuncuyu elektrikli hale gelir. Oyuncunun bıraktığı iz (trail) elektrik kablosuna dönüşür. (henüz yapılmasın game2'de) |
| conveyor (Bant)        | Üzerindeki nesneyi baktığı yöne doğru n miktarda fırlatır/kaydırır. |
| teleporter_in / out    | Giren nesneyi eşleşen çıkışa ışınlar. Çıkış hücresi doluysa ışınlanma gerçekleşmez. Nesnenin girmeden önceki hızı çıkışta aynen korunur (ışınlanıp kaymaya devam edebilir). |
| trampoline | Conveyor gibi nesneyi sürükler fakat aynı zamanda z indexini yükseltir. İndiği yere kadar olan aradaki kareler z indexi zeminden yüksek olduğu için bunu etkilemeyecek zaten |

### Ek Mekanik Kuralları:

- **Buz ve Lav İlişkisi:** Buzun üzerindeyken kayarak haritanın lav olan kenarına düşülürse nesne anında yok olur (oyun kaybedilir).
- **Sonsuz Döngü Koruması** Sonsuz döngü koruması olmalı belli bir sayıdan fazla devam edememeli döngü

---

## 2. Harita Kenarı Kuralları (Edge Behavior)

Haritanın 4 kenarı (Alt, Üst, Sağ, Sol) seviye tasarımında bağımsız olarak yapılandırılabilir:

- **Wall (Duvar):** Nesne harita dışına çıkamaz, kenara çarpar ve durur.
- **Portal (Geçit):** Nesne kenardan çıktığı an, haritanın tam karşısındaki kenarından içeri girer (mor kenarlıkla belirtilir). Hız, yön yükseklik vs korunur.
- **Lava (Lav):** Nesne bu kenardan dışarı adım atarsa yok olur / oyun kaybedilir (kırmızı kenarlıkla belirtilir).

---

## 3. Kutu ve İtme Mekanikleri (Sokoban Mechanics)

Oyuncular, haritadaki kutuları (boxes) iterek engelleri aşabilir veya yollar açabilir.

- **Zincirleme İtme (Chain Push):** Bir kutu diğerine bitişikse, oyuncu hepsini aynı anda tren gibi itebilir. Eğer zincirin en ucunda bir engel (duvar vb.) varsa, hiçbir kutu yerinden kıpırdamaz.
- **Kafa Kafaya Tokuşma:** İki oyuncu aynı anda aynı kutuyu (veya birbirlerini) itmeye/ezmeye çalışırsa iki hareket de iptal olur, nesneler yerinde kalır.
- **Fiziksel Etkileşim:** Kutular sadece oyuncular tarafından itilmez; oyuncular gibi buza basınca kayar, konveyöre binince fırlatılırlar.
- **Güç Gereksinimi (requiresPower):** Bazı ağır kutular, sadece yanındaki veya altındaki hücrede elektrik (Power) varsa itilebilir. Aksi halde duvar gibi davranırlar.

---

## 4. Güç ve Elektrik Sistemi (Power System)

Oyunun bulmaca derinliğini artıran enerji yayılım sistemidir:

- Oyuncu **power_node (Güç Noktası)** hücresine bastığında elektrik yüklenir.
- Elektrik yüklü oyuncunun haritada bıraktığı her adım (**trail**), bir elektrik kablosu işlevi görür.
- Elektrik akımı, kabloya (ize) temas eden yan hücrelere yayılır. Bu sayede çalışmayan bir konveyör bandı çalıştırılabilir veya kilitli bir kutu itilebilir hale getirilebilir.
- **Işınlanan Elektrik:** Eğer elektrik akımı bir ışınlayıcının girişine temas ederse, ışınlayıcının çıkış noktası da etrafına elektrik yaymaya başlar.

---

## 5. İz Çarpışması (Trail Collision)

Seviye tasarımında opsiyonel olarak açılabilen bir zorluk mekaniğidir:

- Oyuncular geçtikleri karelerde arkalarında renkli bir iz bırakırlar.
- Eğer bir oyuncu, rakibinin/diğer oyuncunun bıraktığı izin üzerine basarsa oyun kaybedilir.
- Bu mekanik aktifken oyuncular haritadaki rotalarını birbirlerinin yolunu kesmeyecek şekilde (Snake oyunu gibi) planlamak zorundadır.

---

## 6. Görsel Kimlik (Visual Mapping)

Oyuncuların ve hedeflerin renk kodlaması:

- **Oyuncu 1:** Neon Zümrüt (Emerald) `#00ff88` → Ulaşması gereken hedef: `target_1`
- **Oyuncu 2:** Neon Gök Mavisi (Sky) `#00c4ff` → Ulaşması gereken hedef: `target_2`