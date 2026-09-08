#!/usr/bin/env bash
set -euo pipefail

PACKAGE="app.ciftcidefteri.mobile"
APK="${1:-app-debug.apk}"
EVIDENCE_DIR="${2:-device-evidence}"
DB_NAME="ciftci-defteri.db"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v adb >/dev/null 2>&1 || fail "adb bulunamadı. Android platform-tools kurulmalı."
[[ -f "$APK" ]] || fail "APK bulunamadı: $APK"

mkdir -p "$EVIDENCE_DIR"

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
[[ "$DEVICE_COUNT" -eq 1 ]] || fail "Tam olarak bir yetkili Android cihaz bağlı olmalı. Bulunan: $DEVICE_COUNT"

SERIAL="$(adb get-serialno)"
MODEL="$(adb shell getprop ro.product.model | tr -d '\r')"
ANDROID="$(adb shell getprop ro.build.version.release | tr -d '\r')"
SDK="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
APK_SHA256="$(sha256sum "$APK" | awk '{print $1}')"

cat > "$EVIDENCE_DIR/device.txt" <<EOF
serial=$SERIAL
model=$MODEL
android=$ANDROID
sdk=$SDK
apk_sha256=$APK_SHA256
EOF

# Temiz kurulum bu helper'ın tek otomatik mutasyonudur. Kullanıcı verisi olan bir
# cihazda çalıştırılmamalıdır; kabul protokolü sentetik test verisi gerektirir.
adb uninstall "$PACKAGE" >/dev/null 2>&1 || true
adb install "$APK" | tee "$EVIDENCE_DIR/install.txt"

# Paket gerçekten debug/run-as erişimine açık mı? Bu yalnız test APK'sında beklenir.
adb shell run-as "$PACKAGE" pwd > "$EVIDENCE_DIR/run-as.txt" || fail "Debug paketine run-as erişimi yok."

cat <<'EOF'

APK kuruldu.
Şimdi telefonda ANDROID_DEVICE_ACCEPTANCE_V04.md içindeki A adımını yap:
- interneti kapat
- onboarding'i tamamla
- sentetik bir gelir ve gider ekle
- uygulamayı kapat/aç ve verinin kaldığını doğrula

Bu işlem bittikten sonra ENTER'a bas. Script DB şifreleme kanıtını toplayacak.
EOF
read -r

DB_PATH="$(adb shell run-as "$PACKAGE" sh -c "find . -type f -name '$DB_NAME' -print -quit" | tr -d '\r')"
[[ -n "$DB_PATH" ]] || fail "Cihazda $DB_NAME bulunamadı. Önce uygulamada sentetik kayıt oluştur."

echo "db_path=$DB_PATH" >> "$EVIDENCE_DIR/device.txt"

# Ham veritabanının ilk 32 baytını dışarı al. Anahtar veya DB içeriği loglanmaz.
adb exec-out run-as "$PACKAGE" sh -c "dd if='$DB_PATH' bs=32 count=1 2>/dev/null" > "$EVIDENCE_DIR/db-header.bin"

if head -c 16 "$EVIDENCE_DIR/db-header.bin" | grep -aq "SQLite format 3"; then
  fail "DB düz SQLite başlığı taşıyor; SQLCipher kabulü FAIL."
fi

echo "PASS: DB düz SQLite başlığı taşımıyor." | tee "$EVIDENCE_DIR/db-header-check.txt"

# İzin yüzeyini cihazdan da kaydet; hassas uygulama verisi içermez.
adb shell dumpsys package "$PACKAGE" > "$EVIDENCE_DIR/package-dumpsys.txt"

cat <<EOF

Otomatik cihaz kanıtı toplandı: $EVIDENCE_DIR
- cihaz/Android bilgisi
- APK SHA-256
- temiz kurulum sonucu
- run-as doğrulaması
- şifreli DB başlık kontrolü
- paket/izin dökümü

PIN, yedekleme, Faz 2 finans akışları, güncelleme ve UX adımları fiziksel ekranda
ANDROID_DEVICE_ACCEPTANCE_V04.md'e göre ayrıca PASS/FAIL işaretlenmelidir.
EOF
