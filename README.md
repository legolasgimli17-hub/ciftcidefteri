# Çiftçi Defteri

Türkiye'deki çiftçiler için ürün-duyarlı, offline-first ve ücretsiz gelir/gider uygulaması.

## v0.4 durumu
Faz 1 ve Faz 2 kod kapsamı tamamlandı. Uygulama henüz mağaza/release adayı değildir; ürün anayasasındaki fiziksel Android kabul kapısı geçilmeden gerçek kullanıcı yayını yapılmaz.

Çekirdek akış:

`Onboarding → Benim Defterim → Para girdi/çıktı → Ürüne göre kategori → Şifreli yerel SQLite kayıt → Giren / Çıkan / Kalan`

Faz 2 ayrı görev ekranları:

`Borçlar → Banka hareketleri → Elindekiler → Şifreli yedek → İsteğe bağlı PIN kilidi`

## Mimari ilkeler
- **Local-first:** cihazdaki SQLite birincil veri kaynağıdır; temel kayıt ve okuma internet gerektirmez.
- **Finans doğruluğu:** para `float` değil tam sayı kuruş olarak tutulur.
- **Ürün-duyarlı:** pamuk, mısır, buğday, fındık, tütün ve sebze gibi ürünler ilgili önerileri verir; ilgisiz seçenekler kullanıcıya yüklenmez.
- **Düşük dijital okuryazarlık:** tek ekranda tek iş, büyük dokunma alanları ve günlük Türkçe korunur.
- **Şifreli yerel veri:** SQLCipher yapılandırması ve SecureStore tabanlı cihaz anahtarı zorunludur; normal SQLite'a sessiz fallback yoktur.
- **Güvenli yedek politikası:** Android uygulama yedeği kapalıdır; finansal DB kontrolsüz cihaz/cloud backup akışına bırakılmaz. Manuel yedek ayrı kurtarma anahtarıyla şifrelenir.
- **Fail-closed hesap:** bozuk kaynak veri varsa sessizce yanlış kâr, bakiye veya stok sonucu gösterilmez.
- **Kalite kapısı:** domain testleri + migration/DB constraint testleri + static security + mobile security config + crash privacy + UX jargon taraması.

## Kalite ve release kapısı
- Otomatik kod/CI kontrolleri: `npm run check:core` ve Android native build.
- Fiziksel Android kabulü: `docs/ANDROID_DEVICE_ACCEPTANCE_V04.md`
- Güvenlik ayrıntıları ve açık release blocker'lar: `docs/SECURITY_HARDENING_V04.md`
- Ürün kararlarının ana kontrol listesi: `docs/PRODUCT_CONSTITUTION.md`

Fiziksel cihaz kabulü tamamlanmadan “production güvenli” veya “release hazır” ifadesi kullanılmaz.

## Komutlar
```bash
npm install
npx expo install --check
npm run check:core
npx tsc -p tsconfig.json --noEmit
npx expo-doctor@latest
npx expo run:android
```
