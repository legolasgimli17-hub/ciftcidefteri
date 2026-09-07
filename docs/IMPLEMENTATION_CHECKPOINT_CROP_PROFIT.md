# Uygulama checkpoint — ürün kârlılığı

Bu checkpoint Faz 1'in ürün-duyarlı çekirdeğini güçlendirir; yeni Faz 2 kapsamı açmaz.

## Eklenenler
- Ürün bazlı kâr/zarar read-model'i.
- Ana ekrandan tek dokunuş erişim.
- Mobil `Ürünlerin durumu` ekranı.
- Pamuk/Mısır gibi aktif ürünler için Giren / Çıkan / Kalan.
- Genel kayıtların ürünlere dağıtılmaması.
- Aktif ürüne eşleşmeyen finans kaydında fail-closed davranış.
- SQLite aggregate ile bounded memory kullanımı.
- Veri bütünlüğü testleri.

## Merge kapısı
Quality workflow tamamen yeşil olmadan main'e alınmaz.
