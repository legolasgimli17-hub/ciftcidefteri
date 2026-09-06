# Zorunlu Kalite Kapıları

Bir özellik "bitti" sayılmadan önce aşağıdakilerin tamamı geçer.

1. TypeScript strict typecheck temiz.
2. Unit/domain testleri temiz.
3. Para, tarih, boş değer, aşırı büyük değer ve yinelenen işlem edge-case'leri kontrol edildi.
4. SQL sorguları parametreli; kullanıcı girdisi string birleştirme ile SQL'e sokulmadı.
5. Hassas veri loglanmıyor.
6. Offline senaryo test edildi: internet yokken temel kayıt/okuma çalışıyor.
7. Veri bütünlüğü test edildi: işlem yarıda kesilirse transaction/rollback davranışı güvenli.
8. UX kabulü: tek ekran tek iş, açık gündelik Türkçe, büyük dokunma alanı, gereksiz seçenek yok.
9. Erişilebilirlik: metin ölçeklenmesi ve ekran okuyucu etiketleri kontrol edildi.
10. Güvenlik kontrolü: OWASP MASVS kapsamındaki ilgili storage/auth/network/code maddeleri gözden geçirildi.
11. Cloud eklenmişse RLS testleri hem "kendi verisini görür" hem "başkasının verisini göremez" senaryolarını geçirir.
12. Release build üzerinde smoke test geçmeden mağaza sürümü hazırlanmaz.

## Kural
Bir kontrol başarısızsa özellik merge/release edilmez. "Sonra düzeltiriz" kabul edilmez.
