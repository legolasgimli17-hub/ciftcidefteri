# Çiftçi Defteri v0.4 — Android cihaz kabulü

Bu belge `PRODUCT_CONSTITUTION.md`, `QUALITY_GATES.md` ve `SECURITY_HARDENING_V04.md` içindeki fiziksel Android release kapısını tek, kanıtlanabilir akışa çevirir.

## Kural

Bu kontrol tamamlanmadan uygulama gerçek kullanıcıya, mağaza sürümüne veya “production güvenli” etiketiyle verilmez. Testlerde gerçek çiftçi verisi kullanılmaz; yalnız sentetik ad, not ve tutarlar kullanılır.

## Test edilecek paket

GitHub Actions `android-native` işi şu üç dosyayı tek artifact içinde üretir:

- `app-debug.apk`
- `SHA256SUMS.txt`
- `BUILD_EVIDENCE.txt`

Kabul kaydına test edilen commit SHA ve APK SHA-256 değeri yazılır. Böylece başka bir APK'nın sonucu yanlışlıkla bu sürüme mal edilemez.

### Cihaz kanıtı yardımcısı

Android platform-tools/ADB bulunan bir bilgisayarda yalnız sentetik test cihazı bağlıyken şu yardımcı script kullanılabilir:

```bash
bash scripts/android-device-evidence.sh /path/to/app-debug.apk
```

Script temiz kurulum yapar, cihaz/Android ve APK checksum kanıtını toplar, kullanıcı temel offline kaydı oluşturduktan sonra DB dosyasının düz `SQLite format 3` başlığı taşımadığını doğrular ve paket/izin dökümünü `device-evidence/` klasörüne kaydeder. PIN, yedekleme, finans akışları, güncelleme ve UX kontrollerini kendi kendine PASS saymaz; bunlar fiziksel ekranda aşağıdaki protokole göre doğrulanır.

## A. Kurulum ve temel offline akış

1. Android cihazı internetsiz moda al.
2. APK'yı temiz kurulum olarak yükle ve uygulamayı aç.
3. İlk kurulumu tamamla.
4. En az bir para girdi ve bir para çıktı kaydı oluştur.
5. Uygulamayı tamamen kapatıp yeniden aç.
6. Kayıtların ve Giren / Çıkan / Kalan sonuçlarının değişmediğini doğrula.
7. Ürün seçimine göre ilgisiz kategori gösterilmediğini kontrol et.

**Geçer:** İnternet olmadan temel kayıt/okuma çalışır ve yeniden açılışta veri korunur.

## B. Yerel veritabanı güvenliği

1. Test cihazındaki uygulama DB dosyasını debug erişimiyle al.
2. Dosyanın ilk baytlarının düz SQLite başlığı (`SQLite format 3`) olmadığını doğrula.
3. Normal SQLite istemcisiyle açılmadığını doğrula.
4. SQLCipher kullanılan doğrulama ortamında yanlış anahtarla açmanın başarısız olduğunu doğrula.
5. Uygulamanın kendi doğru SecureStore anahtarıyla yeniden açıldığında kayıtların okunabildiğini doğrula.

**Geçer:** DB yalnız doğru cihaz anahtarıyla açılır; şifreleme sessizce normal SQLite'a düşmez.

## C. Uygulama kilidi

1. Ayarlardan PIN kilidini aç.
2. Doğru PIN ile açılışı doğrula.
3. Uygulamayı arka plana gönderip geri dön; yeniden kilitlendiğini doğrula.
4. Birkaç yanlış PIN denemesi yap; bekleme/sınır politikasının devreye girdiğini doğrula.
5. Uygulamayı kapatıp açmanın yanlış deneme sayacını sıfırlamadığını doğrula.
6. Kilidi kapatmanın mevcut doğru PIN'i gerektirdiğini doğrula.

**Geçer:** Finansal ekranlar kilit doğrulanmadan açılmaz ve brute-force koruması kalıcıdır.

## D. Şifreli yedekleme ve geri yükleme

1. Sentetik kayıtlarla şifreli manuel yedek oluştur.
2. Yedek dosyası ile kurtarma anahtarının ayrı çıktılar olduğunu doğrula.
3. Yanlış kurtarma anahtarıyla geri yüklemeyi dene; mevcut verinin değişmediğini doğrula.
4. Doğru anahtarla geri yükle; kaynak kayıtların eksiksiz döndüğünü doğrula.
5. Geri yüklenen özetlerin kaynak kayıtlardan yeniden türetildiğini doğrula.

**Geçer:** Yanlış/bozuk yedek atomik biçimde reddedilir; doğru yedek veri kaybı olmadan döner.

## E. Faz 2 finans doğruluğu smoke testi

1. Bir nakdi borç oluştur, ödeme ekle ve kalan borcu kontrol et.
2. Bir manuel banka hareketi oluştur; bunun kâr/zarar toplamını değiştirmediğini doğrula.
3. Elindekiler'e miktar ekle ve azalt; kalan miktarı kontrol et.
4. Mevcut kalandan fazla azaltmanın reddedildiğini doğrula.
5. Ortaklı bir gelir/gider kaydı oluştur; ortaklık bakiyesinin kaynak kayıttan türediğini kontrol et.

**Geçer:** Borç, banka ve stok hareketleri ürün anayasasındaki muhasebe sınırlarını bozmaz.

## F. Android güvenlik ve gizlilik kanıtı

1. Üretilmiş merged manifestte kontrolsüz Android backup'ın kapalı olduğunu doğrula.
2. Uygulama boyunca logcat/crash çıktısını incele.
3. Sentetik test adı, not metni, finans tutarı, PIN veya DB anahtarının log/crash olayına taşınmadığını doğrula.
4. Uygulamanın ihtiyaç dışı tehlikeli Android izni istemediğini doğrula.

**Geçer:** Finansal içerik ve sırlar telemetri/log katmanına sızmaz; izin yüzeyi minimumdur.

## G. Güncelleme testi

1. Bir önceki test APK'sında sentetik kayıt oluştur.
2. Uygulamayı kaldırmadan yeni APK'yı üzerine kur.
3. SecureStore anahtarıyla mevcut DB'nin açıldığını ve kayıtların korunduğunu doğrula.
4. Migration sonrasında kaynak kayıt ve türetilmiş özetlerin tutarlı kaldığını kontrol et.

**Geçer:** Uygulama güncellemesi DB ile anahtarın bağını koparmaz ve veri kaybı yaratmaz.

## H. Düşük/orta segment cihaz UX kabulü

Aşağıdaki akışlarda takılma, küçük dokunma alanı, teknik jargon, taşan metin veya okunamayan kontrast olmamalıdır:

- İlk kurulum
- Para girdi / çıktı
- Kayıt geçmişi ve düzeltme
- Ürünlerin durumu
- Ortaklık
- Borç
- Banka hareketi
- Elindekiler
- Yedekleme
- PIN kilidi

Metin boyutu artırılmış Android erişilebilirlik ayarıyla ana işlemler tekrar kontrol edilir.

## Kabul kaydı

- Commit SHA:
- APK SHA-256:
- Cihaz modeli:
- Android sürümü:
- Test tarihi:
- A — Offline temel akış: PASS / FAIL
- B — DB şifreleme: PASS / FAIL
- C — PIN kilidi: PASS / FAIL
- D — Yedekleme/geri yükleme: PASS / FAIL
- E — Faz 2 finans smoke: PASS / FAIL
- F — Gizlilik/izinler: PASS / FAIL
- G — Güncelleme: PASS / FAIL
- H — UX/erişilebilirlik: PASS / FAIL
- Bulunan sorunlar:
- Son karar: RELEASE BLOCKED / DEVICE GATE PASSED

Herhangi bir FAIL sonucu release'i bloklar. Sonuç kanıtlanmadan belge “PASS” olarak işaretlenmez.
