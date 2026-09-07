# Global ürün notları — 2026-09-07

Bu belge rakip kopyalamak için değil, Çiftçi Defteri ürün anayasasına uyan güçlü desenleri kaydetmek için tutulur.

## Gözlenen güçlü desenler
- Traction Ag: finansı tarla/ürün bağlamına bağlayıp alan bazlı kârlılık ve gerçek başa baş bilgisini öne çıkarıyor.
- Ambrook: işletme/enterprise bazında hangi iş kolunun para kazandırdığını sade kâr-zarar görünümüyle ayrıştırıyor.
- AgriWebb: sahadaki temel mobil kayıt akışını online/offline çalıştırıp bağlantı gelince senkron mantığını merkeze koyuyor.

## Çiftçi Defteri kararı
Bu ürünlerden muhasebe jargonu, yoğun dashboard, banka entegrasyonu veya ağır raporlama alınmayacak. Faz 1 içinde yalnız şu fikir uygulanacak:

**Ürünlerin durumu → Pamuk / Mısır / ... → Giren / Çıkan / Kalan**

Kurallar:
- Ana para girdi/çıktı akışına ekstra zorunlu adım eklenmez.
- Ürün özeti tamamen yerel SQLite üzerinden çalışır.
- Genel kayıtlar hiçbir ürüne yanlış dağıtılmaz.
- Bozuk/eşleşmeyen finans kaydı sessizce gizlenmez; özet fail-closed davranır.
- Grafik, filtre, muhasebe terimi ve bulut zorunluluğu eklenmez.
