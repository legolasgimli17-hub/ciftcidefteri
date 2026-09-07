# UX kararı — Defter + ortaklık çekirdeği

## Gerçek problem
Çiftçi yalnız “para girdi / çıktı” toplamı istemiyor. Tarihli giderleri (amele, ilaç, gübre, elektrik, mazot, sulama, biçer, icar vb.) tek tek tutuyor; özellikle ortaklı işlerde kimin ne ödediği ve kimin kime ne kadar borçlu olduğu karışıyor.

## Faz 1 yönü
- “Para girdi / çıktı” hızlı giriş olarak kalır; ürünün merkezi değildir.
- Ana ürün, tarihli ayrıntılı **Defter**dir.
- Kayıt ürün/genel kapsamı, kategori, tutar ve tarih taşır; ortaklıysa ortak, pay ve parayı kimin ödediği/aldığı da kaynak kayda bağlı tutulur.
- Ortaklık bakiyesi ayrı kopya borç satırlarından değil kaynak işlemler + hesap kapatma ödemelerinden türetilir.
- Ortak hesap kapatma ödemeleri gelir/gider değildir; kâr-zararı değiştirmez.
- Kullanıcı açık hesaptan büyük “hesap kapatma” giremez; yanlışlıkla alacak/borç yönünü tersine çevirmeyiz.

## Görsel yön
Hedef “tarım uygulaması” görünümü değil, sakin ve güven veren üst düzey finans ürünü kalitesidir.

- Tek bakışta ana finans sayısı.
- Sonra ürün, gider ve ortaklık kırılımları.
- Emoji yerine uygulamanın kendi offline ürün görselleri.
- Güçlü tipografik hiyerarşi, katmanlı kartlar, kontrollü semantik renk.
- Grafik yalnız soruya cevap veriyorsa kullanılır; dashboard kalabalığı yapılmaz.
- Tarımsal kimlik görselde hissedilir, finansal doğruluk ve okunabilirlikten rol çalmaz.

## Referanslardan alınan ilke, kopyalanmayan tasarım
- Copilot / modern fintech: kritik finans sayısını ve anlamlı kırılımları hızlı görünür yapma.
- Traction / Ambrook: işlemi tarımsal bağlama bağlayıp kârlılığı ürün/iş alanına göre izleme.
- AgriWebb: sahada hızlı kayıt ve offline kullanım.

Birebir arayüz kopyalanmaz; bu ilkeler düşük dijital okuryazarlık ve Türkiye çiftçi iş akışına uyarlanır.
