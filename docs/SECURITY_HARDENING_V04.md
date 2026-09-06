# Çiftçi Defteri v0.4 — Mobile Security Hardening

Bu belge production güvenliği için uygulanan ve henüz fiziksel cihazda kanıtlanması gereken kontrolleri ayırır.

## Bu sürümde kod seviyesinde zorunlu hale gelenler

- Yerel SQLite veritabanı SQLCipher olmadan açılmaz (`PRAGMA cipher_version` fail-closed kontrolü).
- Veritabanı anahtarı 256-bit CSPRNG ile üretilir; kaynak kodda, `.env` dosyasında veya loglarda tutulmaz.
- Anahtar `expo-secure-store` üzerinden Android Keystore / iOS Keychain sınırında saklanır.
- Android uygulama yedeklemesi kapalıdır (`android.allowBackup=false`). Finansal DB'nin Google Drive/cihaz transferi ile kontrolsüz kopyalanması engellenir.
- Anahtar formatı yalnızca 64 karakter hex kabul eder; SQLCipher PRAGMA'sına serbest kullanıcı girdisi girmez.
- `requireAuthentication` şimdilik kullanılmaz. Amaç biyometri değişikliği yüzünden çiftçinin kendi muhasebe verisine kalıcı erişim kaybı yaşamamasıdır.
- DB açılışında foreign key ve WAL değerleri okunarak gerçekten etkin oldukları doğrulanır.
- Şema sürümü artık migration runner tarafından yönetilir; ileri sürümlü veya bozuk schema_version sessizce ezilmez.
- CI, SQLCipher + SecureStore + backup yapılandırmasını ayrıca kontrol eder.

## Release blocker — gerçek cihaz kanıtı olmadan tamamlandı sayılmaz

1. Android development build SQLCipher ile derlenmeli.
2. Fiziksel Android cihazda ilk açılış, kayıt ekleme, uygulama kapatma/açma ve kayıtların korunması doğrulanmalı.
3. Ham DB dosyasının normal SQLite ile okunamadığı doğrulanmalı.
4. Yanlış anahtarla DB'nin açılamadığı doğrulanmalı.
5. Uygulama güncellemesinde SecureStore anahtarının ve DB'nin birlikte çalışmaya devam ettiği doğrulanmalı.
6. Android backup/restore ve cihaz transferi davranışı native manifest çıktısından doğrulanmalı.
7. Crash/log çıktısında isim, telefon, finans tutarı, not veya DB anahtarı bulunmadığı kontrol edilmeli.

Bu maddeler kanıtlanmadan README veya release notlarında “production güvenli” ifadesi kullanılmaz.
