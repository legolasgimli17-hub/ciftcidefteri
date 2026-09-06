# Mimari Karar — Foundation v0.1

## Ürün yönü
- Android-first gerçek mobil uygulama.
- Faz 1: onboarding, ürün seçimi, ürün-duyarlı gelir/gider, basit kâr-zarar, offline çalışma.
- Çekirdek özellikler ücretsiz; ödeme duvarı yok.

## Teknik yön
- UI: React Native + Expo + TypeScript (Expo SDK 57 hattı).
- Navigasyon: Expo Router.
- Yerel veri: SQLite. Cihazdaki veri Faz 1'de birincil kaynaktır.
- Hassas sırlar: SecureStore; veritabanı anahtarı uygulama koduna veya normal AsyncStorage'a yazılmaz.
- Üretim yerel DB: SQLCipher hedefi; bunun için development/production build kullanılır, Expo Go güvenlik doğrulaması için yeterli kabul edilmez.
- Bulut/senkronizasyon: Faz 1 çekirdeğinden ayrılmış port/adaptör katmanı. Supabase ileriki senkronizasyon için adaydır; RLS'siz kullanıcı verisi tablosu kabul edilmez.

## Domain kuralları
- Para `float`/`REAL` olarak tutulmaz. TRY tutarları tam sayı kuruş (`INTEGER`) olarak saklanır.
- Kullanıcı arayüzü dili muhasebe terimleri yerine günlük Türkçe kullanır.
- Ürün şablonları domain verisidir; UI içine gömülü koşul yığınına dönüşmez.
- Silme işlemleri senkronizasyon güvenliği için önce soft-delete olarak modellenir.
- Her yazılabilir kayıtta `created_at`, `updated_at`, `sync_state`; senkronize edilenlerde tombstone/deleted_at mantığı bulunur.
