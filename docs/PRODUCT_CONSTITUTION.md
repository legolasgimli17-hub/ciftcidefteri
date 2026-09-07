# Ürün Anayasası — yaşayan sürüm

Bu belge firstpromptun geliştirme sırasında uygulanacak kısa kontrol listesidir. Firstprompt ana referanstır; gerçek kullanıcı geri bildirimi veya daha sağlam bir çözüm bulunduğunda kontrollü biçimde iyileştirilebilir.

## Değişmez hedef
Türkiye'deki çiftçinin tarihli gelir-gider defterini, ürün maliyetini, ortaklı işlerde kimin ne ödediğini ve sonunda kimin kimden ne kadar alacağı olduğunu muhasebe eğitimi gerektirmeden net görebilmesi.

## Faz 1 sınırı
1. İlk kurulum ve ürün seçimi
2. Tarihli, kategorili ve ürüne duyarlı detaylı gelir-gider defteri
3. Çiftçiye uygun temel gider kalemleri: işçilik/amele, gübre, ilaç, mazot, sulama/elektrik, biçer-hasat, icar/kira, tohum-fide, nakliye, bakım ve diğer
4. Ürün bazlı gelir, gider ve kalan para
5. Ortaklı kayıt: ortak, pay oranı ve giderde kimin ödediği / gelirde paranın kime geldiği
6. Ortaklık bakiyesi: işlem defterinden türetilen alacak-borç özeti; ayrı ve kopabilecek ikinci bir borç defteri tutulmaz
7. Filtrelenebilir kayıt geçmişi, düzeltme, silme ve geri alma
8. İnternetsiz temel kullanım
9. Güven veren, tarımı görsel olarak hissettiren ama finansal bilgiyi gölgelemeyen mobil arayüz

Faz 1 sağlamlaşmadan banka entegrasyonu, kredi yönetimi, OCR, hava durumu veya AI katmanı ana akışa eklenmez.

## Her ekran için kapı
- İlk bakışta ne yapılacağı anlaşılmalı.
- Teknik muhasebe jargonu kullanılmamalı.
- Dokunma alanı 48px altına düşmemeli.
- Gereksiz adım atlanmalı.
- İleri alanlar gerektiğinde açılmalı; ortaklı değilse ortaklık ayrıntıları kullanıcıyı yormamalı.
- İnternet yokluğu temel kaydı engellememeli.
- Ürünle ilgisiz seçenek gösterilmemeli.
- Hata mesajı kod değil, yapılacak şeyi söylemeli.
- Hesap özeti her zaman ayrıntılı defterdeki gerçek kayıtlara kadar izlenebilir olmalı.
- Pamuk, mısır, buğday, sebze ve diğer ürünler ayırt edilebilir kaliteli görsel kimliğe sahip olmalı; görseller sayıların okunmasını zorlaştırmamalı.

## Ortaklık muhasebesi kapısı
- Para ve pay hesabında kayan nokta kullanılmaz; tutar tam sayı kuruş, oran tam sayı baz puan (10.000 = %100) tutulur.
- Ortaklık alacak/borcu elle çoğaltılmış ikinci veri değildir; kaynak işlem + pay + parayı ödeyen/alan kişiden deterministik olarak hesaplanır.
- Bir işlem düzeltildiğinde veya geri alındığında ortaklık bakiyesi aynı atomik gerçek kaynaktan yeniden oluşmalıdır.
- Yuvarlama kuruş seviyesinde deterministik olmalı ve işlem toplamı hiçbir zaman değişmemelidir.

## Mühendislik kapısı
- Para tam sayı kuruş.
- Veritabanı constraint + foreign key.
- Çoklu yazma atomic transaction.
- Çoklu dokunma/çift kayıt riskine karşı tek-uçuş kayıt kapısı.
- Her değişiklik test + static security + UX language gate.
- Production release öncesi cihazdaki finans verisi şifreleme doğrulaması zorunlu.
- Özet veya bakiye kaynağı bozuksa sistem sessizce yanlış finansal sonuç göstermez; fail-closed davranır.

## Ücretsiz kullanım
Çekirdek çiftçi defteri para duvarına konmaz. Temel gelir-gider, ürün, ortaklık ve kâr-zarar takibi herkes için ücretsiz kalır.
