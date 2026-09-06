# Çiftçi Defteri

Türkiye'deki çiftçiler için ürün-duyarlı, offline-first ve ücretsiz gelir/gider uygulaması.

## v0.4 hardening durumu
Gerçek Expo/Android uygulama kabuğu üzerinde güvenlik ve veri dayanıklılığı katmanı güçlendiriliyor. İlk çalışan akışın hedefi:

`Onboarding → Benim Defterim → Para girdi/çıktı → Ürüne göre kategori → Şifreli yerel SQLite kayıt → Kâr/zarar özeti`

## Mimari ilkeler
- **Local-first:** Faz 1'de cihazdaki SQLite birincil veri kaynağıdır.
- **Finans doğruluğu:** para `float` değil tam sayı kuruş olarak tutulur.
- **Ürün-duyarlı:** pamuk, mısır, buğday, fındık, tütün, sebze ayrı öneriler verir.
- **Düşük dijital okuryazarlık:** tek ekranda tek karar, büyük butonlar, günlük Türkçe.
- **Şifreli yerel veri:** SQLCipher yapılandırması ve SecureStore tabanlı cihaz anahtarı zorunludur; normal SQLite'a sessiz fallback yoktur.
- **Güvenli yedek politikası:** Android uygulama yedeği kapalıdır; finansal DB kontrolsüz cihaz/cloud backup akışına bırakılmaz.
- **Kalite kapısı:** domain testleri + migration/DB constraint testleri + static security + mobile security config + UX jargon taraması.

## Komutlar
```bash
npm install
npx expo install --check
npm run check:core
npx tsc -p tsconfig.json --noEmit
npx expo-doctor@latest
npx expo run:android
```

> Bu çalışma henüz mağaza sürümü değildir. `docs/SECURITY_HARDENING_V04.md` gerçek cihazda doğrulanması gereken release blocker'ları açıkça tutar.
