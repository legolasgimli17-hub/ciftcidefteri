# EkinCep Faz 10–11 — Super-app dönüşüm notları

## Ürün hedefi
EkinCep, özellik listesi sunan bir tarım uygulaması yerine çiftçinin günlük kararlarını hızlandıran bir “çiftlik komuta merkezi” olarak tasarlanır. Ana ekran; sezon sonucu, tarla/saha, hava, ürün piyasası ve akaryakıt bilgisini tek bakışta anlaşılır tutar. Ayrıntılı finans ve analiz kullanıcı istediğinde açılır.

## Rakip benchmark sonucu
Tarım Cebimde'nin güçlü tarafı geniş hizmetleri sade kategori kartlarıyla sunması ve tarımsal bağlamı güçlü görsellerle hissettirmesidir. EkinCep bu yaklaşımı kopyalamaz; daha kişisel ve operasyonel bir ana ekran kurar. Kullanıcının kendi tarla/ürün/masraf verisi her zaman genel hizmet kataloğundan daha üst önceliktedir.

## Faz 10 — canlı saha altyapısı
- Uydu tabanı: Esri World Imagery. Pan/zoom, il-ilçe arama, parsel konumu kaydetme.
- Uydu ekranı “canlı kamera” değildir; sağlayıcı ve görüntünün niteliği görünür biçimde açıklanır.
- Akaryakıt: EPDK Günlük Akaryakıt Fiyat Bülteni. Gateway gerçek smoke testinde `raporTarihi` için `dd.MM.yyyy` biçiminin gerekli olduğu doğrulandı.
- Ürün fiyatı: TOBB genel portalının TLS sertifika zinciri Node/Vercel doğrulamasında sorun çıkardığı için TLS doğrulaması kapatılmadı. Güvenli HTTPS çalışan Gaziantep Ticaret Borsası salon satış fiyatları kaynak olarak kullanıldı.
- GTB fiyatında uygulamada gösterilen referans değer, yayımlanan en az/en çok aralığının orta noktasıdır ve bu durum payload `priceType`/`note` alanlarında açıkça belirtilir.
- Çevrimdışı kullanım: son başarılı hava/fiyat verisi ve sınırlı uydu cache'i gösterilebilir.

## Faz 11 — premium görsel sistem
- Ana finans hero'sunda kullanıcının ürününe göre değişen gerçek tarım fotoğrafı kullanılır.
- Bu ilk dilimde kullanılan fotoğraflar Wikimedia Commons üzerinden CC0 lisanslı buğday, mısır ve domates fotoğraflarıdır.
- Ana ekran bilgi sırası: sezon net sonucu → hızlı gelir/masraf → canlı saha verileri → tarlalar → detaylı özet.
- Tekrarlanan ileri metrikler “Detaylı çiftlik özeti” altında katlanır; düşük dijital okuryazarlıkta bilgi yükü azaltılır.
- Alt navigasyon yalnız metin yerine yüksek kontrastlı ikon + kısa etiket kullanır; dokunma hedefleri 52px altına düşmez.
- Hareket azaltma tercihi (`prefers-reduced-motion`) desteklenir.
- Fotoğraf cache'i 24, uydu tile cache'i 160 kayıtla sınırlandırılır.

## Sonraki güvenli aşamalar
1. Gerçek cihaz görsel/ergonomi smoke testi ve çiftçi geri bildirimi.
2. Hal Kayıt Sistemi için sebze-meyve fiyat adaptörü; kaynak/tarih doğrulaması olmadan rakam gösterilmez.
3. Sentinel-2 tabanlı NDVI/bitki sağlığı zaman serisi; istemciye anahtar gömmeden sunucu taraflı kimlik yönetimiyle.
4. Tarla bazında hava + piyasa + geçmiş maliyetleri birleştiren karar özeti. Bu katman finans ve saha gözlemi seviyesinde kalır; tehlikeli kimyasal kullanım talimatı üretmez.
