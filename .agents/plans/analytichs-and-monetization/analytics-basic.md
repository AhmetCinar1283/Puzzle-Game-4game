⚠️ YAPAY ZEKA AGENT'LARI İÇİN SİSTEM NOTU (SYSTEM NOTE FOR AI AGENTS)
Bu belge tamamen bir GELECEK PLANLAMASI ve FİKİR HAVUZUDUR. Şu anki aktif kod tabanıyla, mevcut mimariyle veya anlık görevlerle HİÇBİR İLGİSİ YOKTUR. Kullanıcı (geliştirici) açıkça talep etmedikçe bu özellikler için kod üretmeye çalışmayın, mimariyi buna göre değiştirmeyin veya mevcut sorunları çözerken bu dosyayı referans almayın. Bu aşamada bu dosyayı tamamen görmezden gelin.

## Grid Bulmaca Oyunu - Gelecek Vizyonu ve Tasarım Fikirleri

### 1. Telemetri ve Veri Analizi

Oyunun dengesini sağlamak için toplanan oyuncu verilerinin analiz edilmesi planlanmaktadır.

- **Zorluk Eğrisi Kontrolü:** Bölüm tamamlama süreleri ve adım sayıları izlenerek, oyuncuların zorlandığı "zorluk duvarları" (ani zorluk artışları) tespit edilecek ve bölümler arası geçişler yumuşatılacak.
- **Terk Etme (Churn) Analizi:** Oyuncuların oyunu kalıcı olarak kapattığı bölümler belirlenerek, bu kısımlardaki mekanikler daha anlaşılır hale getirilecek veya basitleştirilecek.
- **Bölüm Tasarımı Açıkları (Exploits):** Tasarlanan "optimum adım sayısı" ile oyuncuların "gerçekleşen adım sayısı" karşılaştırılacak. Beklenenden çok kısa sürede biten bölümlerdeki kestirmeler (açıklar) veya çok uzun süren deneme-yanılma (brute-force) noktaları onarılacak.

### 2. Gelir Modelleri (Monetization)

Oyun deneyimini bozacak zorunlu banner reklamlar yerine, oyuncu dostu modeller entegre edilecek.

- **Mikro Ödemeler:** Bölümlerde takılan oyuncular için "İpucu (Hint)" ve yanlış hamle yapanlar için "Hamle Geri Alma (Undo)" haklarının satışı yapılacak.
- **Ödüllü Reklamlar (Opt-in Ads):** Oyuncuların kendi rızasıyla izleyeceği reklamlar karşılığında ekstra can, ipucu veya geri alma hakkı sunulacak.
- **Freemium Yapı:** Oyunun ilk bölümleri (örn. 1-30) tamamen ücretsiz olacak. İleri seviyeler ve ekstra içerikler tek seferlik "Premium Paket" olarak satılacak.
- **Kozmetik Ürünler:** Izgara arka planları, farklı geometrik şekiller veya temalar (uzay, neon vb.) için mağaza eklenecek.


### 3. İlerleme Hızı (Pacing) ve Sürdürülebilirlik


İçeriğin çok hızlı tüketilmesini engellemek ve oyuncuyu her gün oyuna döndürmek (retention) için sistemler kurulacak.

- **Can ve Enerji Sistemi:** Oyuncunun maksimum limiti olan (örn. 5) bir can sistemi olacak. Canlar sadece bölüm kaybedildiğinde veya pes edildiğinde eksilecek ve belirli bir süre içinde (örn. 30 dk) otomatik dolacak.
- **Sonsuz İçerik Çözümleri:**
    - **Algoritmik (Prosedürel) Üretim:** Belirli kurallara dayalı olarak kod tarafından sonsuz ve rastgele seviyeler üretilecek.
    - **Topluluk Modu (Level Editor):** Oyuncuların kendi bölümlerini tasarlayıp bir bulut sisteminde diğer oyuncularla paylaşabilmesi sağlanacak.
    - **Günlük Meydan Okumalar (Daily Challenges):** Her gün yenilenen, tüm oyuncuların aynı bölümleri çözerek küresel liderlik tablosunda yarıştığı özel bir mod eklenecek.