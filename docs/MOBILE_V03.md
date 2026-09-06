# v0.3 — Gerçek mobil kabuk

## Eklenenler
- Expo Router tabanlı Android-first mobil kabuk
- SQLiteProvider ile uygulama yaşam döngüsüne bağlı yerel veritabanı
- Expo SQLite adapter; yazma işlemlerinde exclusive transaction
- WAL + foreign key başlangıç politikası
- Adım adım onboarding: ad → telefon → konum → arazi → ürün → ÇKS
- Ana ekran: büyük gelir/gider aksiyonları, sade net durum, son kayıtlar
- Akıllı hızlı işlem akışı: tek ürün varsa ürün adımı otomatik atlanır
- Ürüne göre gider önerileri
- UX jargon statik kalite kapısı

## Bilinçli olarak henüz release edilmez
SQLCipher anahtar yönetimi gerçek development build üzerinde kurulup doğrulanmadan üretim yayını yapılmayacak. Normal Expo Go geliştirme rahatlığı uğruna finansal veri şifrelemesi “tamam” sayılmayacak.

## UX kontrolü
- Ana eylemler 64px minimum yükseklik
- Teknik muhasebe dili yok
- Varsayılan tarih bugün; kullanıcı gereksiz adım görmez
- Tek ürün kullanan çiftçide ürün seçme adımı atlanır
- Offline kayıt ana akışın varsayılan davranışıdır

## Source authority
`docs/PRODUCT_CONSTITUTION.md` yaşayan kısa kontrol listesidir. Orijinal firstprompt ürün kararlarında ana referans olarak korunur ve değişiklikler onun niyetini bilinçli biçimde korumalı veya açıkça revize etmelidir.

## Current release blockers
- Real Expo dependency install + full TypeScript compile
- Expo Doctor clean run
- Android development build on a physical/emulated device
- SQLCipher + secure key management verification before production
- Package lockfile committed after dependency resolution
