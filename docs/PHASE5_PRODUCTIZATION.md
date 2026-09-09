# Çiftçi Defteri — Faz 5 Ürünleşme

## Amaç

Çiftçi Defteri'ni yalnızca özellik sayısı yüksek bir kayıt aracı olmaktan çıkarıp, düşük dijital okuryazarlıkta da anlaşılır, tarla merkezli ve denetlenebilir bir çiftlik defteri haline getirmek.

## Çekirdek ürün kararları

- Ana ekran para toplamından ibaret değildir: sezon özeti, tarla kartları, en büyük masraf kategorileri ve eldeki ürünlerin tahmini değeri birlikte gösterilir.
- Defter varsayılan olarak masrafları kategori kartları halinde gösterir. Her kartta kategori toplamı ve kayıt sayısı bulunur.
- Defter kayıtlarında kullanıcıya silme eylemi sunulmaz; yalnız `Düzenle` vardır. Düzenleme kayıt `id` ve `createdAt` değerini korur, `updatedAt` ekler.
- Arama ve ürün filtresi defterde yereldir ve offline çalışır.
- Normal telefon tipi hesap makinesi tarımsal kısa hesaplardan ayrıdır; dört işlem, yüzde, işaret değiştirme, geri silme ve hata durumu içerir.
- Piyasa fiyatları gerçek satış garantisi olarak gösterilmez. Her satırda kaynak, tarih ve referans türü görünür.
- Kullanıcı kendi beklediği TL/kg fiyatını girebilir. Kullanıcı fiyatı varsa ürün değeri hesabında kamu referansının önüne geçer.
- Güvenilir güncel referans bulunmayan ürün için rakam uydurulmaz; kullanıcı kendi fiyatını girebilir.

## Piyasa referans veri seti — 2026-09

Kaynaklar 8 Eylül 2026 çevresindeki en güncel kamuya açık verilerden elle doğrulanmıştır. Veri çalışma zamanında web scraping ile çekilmez; uygulama paketinde kaynak/tarih bilgisiyle birlikte bulunur. Böylece internet yokken de görülebilir ve kaynak değişiklikleri uygulamayı bozmaz.

### TOBB / Ticaret Borsaları

- Buğday: 16,315–20,166 TL/kg — Uzunköprü Ticaret Borsası, 08.09.2026.
- Arpa: 13,510–14,210 TL/kg — Edirne Ticaret Borsası, 28.08–02.09.2026.
- Ayçiçeği (yağlık): 35,510–41,540 TL/kg — Edirne Ticaret Borsası, 08.09.2026.
- Kanola: 21,260–32,664 TL/kg — Bandırma/Edirne/Uzunköprü borsa referansları, Ağustos 2026.

### Kahramanmaraş Ticaret Borsası

- Mısır: 13–14 TL/kg — 07.09.2026.
- Kütlü pamuk: 45–50 TL/kg — 07.09.2026.

### Türkiye Ziraat Odaları Birliği — 28.08.2026 üretici fiyatları

- Domates 17,92; sivri biber 41,68; patlıcan 17,90; salatalık 13,08; kabak 16,02; patates 17,66; kuru soğan 17,75; havuç 10,66 TL/kg.
- Elma 18,75; şeftali 30,00; limon 10,00 TL/kg.
- Nohut 32,22; kuru fasulye 39,86; yeşil mercimek 22,82; kırmızı mercimek 44,83 TL/kg.
- İç fındık 410; Antep fıstığı 600 TL/kg.

### TÜRKŞEKER

- Şeker pancarı için 2025-2026 sezonu eski referansı 3,10 TL/kg'dır. Faz 5 arayüzü bunu açıkça eski sezon olarak etiketler; güncel 2026-2027 fiyatı gibi sunmaz.

## Fiyat verisi güvenlik/ürün kuralları

1. Kaynak ve tarih gizlenmez.
2. Tek bir üretici ortalaması, borsa min-max aralığı gibi gösterilmez.
3. Farklı ürün biçimleri eşleştirilmez (ör. kuru kayısı fiyatı taze kayısıya atanmaz).
4. Fiyat bulunamayan ürün için tahmini rakam üretilmez.
5. Ürün değeri muhasebe geliri değildir; deftere otomatik gelir kaydı oluşturmaz.

## Kabul kriterleri

- Phase 3, Phase 4 ve Phase 5 JavaScript syntax kontrolleri geçmeli.
- Phase 5 çekirdek hesapları ayrı birim testleriyle doğrulanmalı.
- APK içinde Phase 5 asset'leri bulunmalı.
- Hava durumu için INTERNET izni olabilir; GPS/konum izni olmamalı.
- Defter Phase 5 görünümünde `Sil` eylemi bulunmamalı.
- Ürün değeri ve piyasa fiyatı gerçek gelir toplamını değiştirmemeli.
