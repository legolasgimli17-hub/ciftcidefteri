# Çiftçi Defteri

Türkiye'deki çiftçiler için ürün-duyarlı, offline-first ve ücretsiz gelir/gider uygulaması.

## v0.3 durumu
Gerçek Expo/Android uygulama kabuğu oluşturuldu. İlk çalışan akışın hedefi:

`Onboarding → Benim Defterim → Para girdi/çıktı → Ürüne göre kategori → Yerel SQLite kayıt → Kâr/zarar özeti`

## Mimari ilkeler
- **Local-first:** Faz 1'de cihazdaki SQLite birincil veri kaynağıdır.
- **Finans doğruluğu:** para `float` değil tam sayı kuruş olarak tutulur.
- **Ürün-duyarlı:** pamuk, mısır, buğday, fındık, tütün, sebze ayrı öneriler verir.
- **Düşük dijital okuryazarlık:** tek ekranda tek karar, büyük butonlar, günlük Türkçe.
- **Güvenlik kapısı:** production öncesi SQLCipher + cihaz anahtar yönetimi gerçek build üzerinde doğrulanmadan release yok.
- **Kalite kapısı:** domain testleri + DB constraint testleri + static security + UX jargon taraması.

## Komutlar
```bash
npm install
npx expo install --fix
npm run check:core
npx expo-doctor@latest
npx expo run:android
```

> Bu çalışma henüz mağaza sürümü değildir. `docs/SECURITY_REVIEW_2026-09-06.md` ve `docs/MOBILE_V03.md` release engellerini açıkça tutar.
