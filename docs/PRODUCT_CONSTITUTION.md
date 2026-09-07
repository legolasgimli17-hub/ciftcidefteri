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

## Faz 2 sınırı — finansal derinlik
Faz 2 firstprompt sırasını korur ve üç katmanda ilerler:
1. Kredi / borç takibi: nakdi ve ayni borç ayrımı, toplam borç, taksit planı, ödeme hareketleri, kalan borç ve sıradaki ödeme
2. Manuel banka hareketleri: kullanıcı bankadaki hareketi kendi girer; açık bankacılık entegrasyonu bu fazın parçası değildir
3. Basit stok / envanter: eldeki ürün veya girdi miktarı, giriş-çıkış hareketleri ve kalan miktar

Faz 2 günlük Defter ekranını büyütmez. Borç, banka ve stok ayrı tek görevli ekranlarda yaşar; kullanıcı istemedikçe ana akışta görünmez.

OCR, açık bankacılık, destekleme otomasyonu, hava durumu ve AI Faz 2 kapsamına girmez.

## Borç muhasebesi kapısı
- Kredi veya borç almak kâr-zarar hesabında gelir sayılmaz.
- Borç anaparası ödemek kâr-zarar hesabında gider sayılmaz.
- Borç bakiyesi elle tutulan ikinci bir sayı değildir; toplam borç eksi geçerli ödeme hareketlerinden türetilir.
- Nakdi borç ile ayni borç ayrı tür olarak tutulur. Ayni borçta çiftçinin ne aldığı günlük dille kaydedilir (ör. gübre, tohum, mazot).
- Taksit planı borcun toplamıyla kuruş seviyesinde tam eşleşmelidir; yuvarlama veya toplam kaybı kabul edilmez.
- Ödeme kalan borcu aşamaz. Bozuk veya tutarsız veri varsa yanlış bakiye göstermek yerine hesap gösterilmez.
- Kullanıcı dili “Kredi anapara bakiyesi” değil “Ne kadar borcun kaldı?” gibi gündelik Türkçe olmalıdır.

## Banka muhasebesi kapısı
- Bankadan kendi paranı çekmek gelir değildir; bankaya kendi paranı yatırmak gider değildir. Bunlar yalnız paranın yer değiştirmesidir.
- Manuel banka hareketleri gelir-gider Defterine otomatik işlem yazmaz ve kâr-zarar toplamını değiştirmez.
- Başlangıç bakiyesi veya güvenilir tam hesap kaynağı yoksa “bankada şu kadar paran var” diye bakiye tahmini gösterilmez.
- Faz 2'de yalnız kullanıcının kendi girdiği “Bankadan çektim / Bankaya yatırdım” hareketleri tutulur. OCR ve açık bankacılık bu fazın dışında kalır.
- Banka adı isteğe bağlıdır; hareket kaydetmek için gereksiz hesap numarası, IBAN veya banka bağlantısı istenmez.
- Yanlış banka hareketi hard-delete edilmez; düzeltilebilir/geri alınabilir kaynak kayıt olarak tutulur.

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
Çekirdek çiftçi defteri para duvarına konmaz. Temel gelir-gider, ürün, ortaklık, borç, manuel banka hareketleri ve kâr-zarar takibi herkes için ücretsiz kalır.
