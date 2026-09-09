# EkinCep Faz 10 — Super App Dönüşümü

Bu fazın amacı yeni özellik yığını eklemek değil; mevcut özellikleri ürün, veri ve mimari olarak profesyonel seviyeye çıkarmaktır. Ürün Anayasası değişmez: günlük çiftçi defteri, muhasebe doğruluğu ve offline temel kullanım her yeni modülden önce gelir.

## 1. Ürün omurgası

Ana sayfa bir “özellik menüsü” değil, **çiftlik komuta merkezi** olur:
- Bugün: hava ve kritik uyarılar
- Bu sezon: gelir, gider, net sonuç
- Tarlalar: her parsel için ürün, son işlem, son masraf, uydu görünümü
- Canlı veriler: ürün fiyatları ve akaryakıt fiyatları; her kartta kaynak ve veri zamanı
- Hızlı işler: masraf, gelir, borç, hesap makinesi

## 2. Uydu / harita

İki katman ayrı tutulur:
1. **Uydu tabanı:** tarlayı yüksek çözünürlüklü uydu/hava fotoğrafı üzerinde görme. Bu “canlı kamera” değildir ve görüntü tarihi kaynağa göre değişir.
2. **Bitki sağlığı:** Sentinel-2/NDVI ve zaman serisi. Copernicus Data Space veya Sentinel Hub kimliği gerekir. OAuth/instance anahtarı istemci içine gömülmez; yalnız sunucu tarafında tutulur.

İlk sürümde kullanıcı haritadan parsel merkezi seçer, konumu yerelde saklanır. Sonraki katmanda polygon/alan çizimi ve Sentinel-2 analizi eklenir.

## 3. Canlı piyasa verisi

Ürün fiyatları için kaynak önceliği:
- TOBB Ticaret Borsaları günlük fiyatları
- Tarım ve Orman Bakanlığı/TEPGE dönemsel piyasa verileri
- Kullanıcının kendi satış fiyatı

Her fiyat satırı şu alanları taşır: ürün, varyete/kalite, birim, min, max, ortalama, borsa/kaynak, işlem tarihi, son güncellenme. Eski veri otomatik “canlı” diye gösterilmez.

## 4. Akaryakıt

EPDK resmi akaryakıt bayi fiyat servisleri kaynak alınır. Kullanıcı il seçer; motorin/benzin/LPG için il bazında son resmi veri gösterilir. “Anlık” ifadesi yalnız kaynak güncelliği uygunsa kullanılır; aksi halde “son resmi veri” yazılır.

## 5. Offline-first

- Finans kayıtları ve kullanıcı tarlaları tamamen yerel/şifreli kalır.
- Son başarılı hava, piyasa ve akaryakıt yanıtı IndexedDB/CacheStorage’a alınır.
- İnternet yoksa veri kartında “Son güncelleme: …” görünür.
- Uzaktan veri başarısızsa temel defter ve kayıt akışı etkilenmez.

## 6. Tasarım sistemi

KârKalkan’dan alınan profesyonel hiyerarşi korunur ancak tarım için daha görsel hale gelir:
- gerçek tarla/ürün fotoğrafları yalnız bağlam kartlarında
- finansal sayıların arkasında fotoğraf kullanılmaz
- yüksek güneş kontrastı
- 52px+ dokunma hedefi
- tek ekranda tek ana iş
- harita, fiyat ve hava kartlarında kaynak + zaman etiketi

## 7. Güvenlik / API

- Hiçbir üçüncü taraf API anahtarı WebView/PWA JS içine gömülmez.
- Fiyat/uydu proxy’leri Vercel serverless/edge katmanından geçer.
- Kaynak response boyutu, timeout ve allowlist uygulanır.
- Finans içeriği telemetriye gönderilmez.
- Uydu/parsel koordinatları varsayılan olarak yerel kalır; analiz API’sine yalnız kullanıcı o ekranı açtığında gereken geometri gönderilir.

## 8. Kabul kapıları

- Mevcut Phase 3/4/5/7/8/9 testleri yeşil.
- İnternetsiz gelir/gider kaydı çalışır.
- Canlı veri kartları kaynak ve timestamp olmadan değer göstermez.
- Silinmiş kayıt hiçbir toplamda görünmez.
- Uydu ekranı “canlı” iddiası yapmaz; görüntü kaynağını açık gösterir.
- API başarısızlığı ana uygulamayı bozmaz.
