# Ürün Anayasası — yaşayan sürüm

Bu belge firstpromptun geliştirme sırasında uygulanacak kısa kontrol listesidir. Firstprompt ana referanstır; gerçek kullanıcı geri bildirimi veya daha sağlam bir çözüm bulunduğunda kontrollü biçimde iyileştirilebilir.

## Değişmez hedef
Türkiye'deki çiftçinin gelirini, giderini, ürününü ve elinde kalan parayı muhasebe eğitimi gerektirmeden anlayabilmesi.

## Faz 1 sınırı
1. İlk kurulum ve ürün seçimi
2. Ürüne duyarlı para girdi / para çıktı kaydı
3. Basit kâr-zarar özeti
4. İnternetsiz temel kullanım

Faz 1 sağlamlaşmadan kredi, banka, OCR, hava durumu veya AI katmanı ana akışa eklenmez.

## Her ekran için kapı
- İlk bakışta ne yapılacağı anlaşılmalı.
- Teknik muhasebe jargonu kullanılmamalı.
- Dokunma alanı 48px altına düşmemeli.
- Gereksiz adım atlanmalı.
- İnternet yokluğu temel kaydı engellememeli.
- Ürünle ilgisiz seçenek gösterilmemeli.
- Hata mesajı kod değil, yapılacak şeyi söylemeli.

## Mühendislik kapısı
- Para tam sayı kuruş.
- Veritabanı constraint + foreign key.
- Çoklu yazma atomic transaction.
- Her değişiklik test + static security + UX language gate.
- Production release öncesi cihazdaki finans verisi şifreleme doğrulaması zorunlu.

## Ücretsiz kullanım
Çekirdek çiftçi defteri para duvarına konmaz. Temel gelir-gider, ürün ve kâr-zarar takibi herkes için ücretsiz kalır.
