# Güvenlik Tabanı

- Mobil güvenlik referansı: OWASP MASVS.
- Uygulama içine service-role/admin anahtarı gömülmez.
- Hassas token/şifre/DB anahtarı normal storage'da tutulmaz.
- Yerel finans verisi production hedefinde şifreli SQLite/SQLCipher ile korunur.
- DB anahtarı SecureStore/OS keystore-keychain üzerinden yönetilir.
- SQL kullanıcı girdileri prepared/parameterized statement ile işlenir.
- Kayıt ID'leri tahmin edilebilir sıra numarası yerine rastgele/UUID-benzeri kimlik kullanır.
- Kullanıcı verisi başka kullanıcıyla varsayılan olarak paylaşılmaz.
- Cloud senkronizasyonunda her kullanıcıya ait tablo RLS ile kapalı başlar.
- Public/anonymous yazma politikası yoktur.
- Log/crash raporlarına tutar açıklaması, telefon, belge fotoğrafı veya token gönderilmez.
- Fotoğraf/fiş özelliği geldiğinde dosya türü, boyutu, metadata ve erişim yetkisi ayrı tehdit modeliyle ele alınır.
- Dependency audit ve secret scan CI'da zorunludur.
