package app.ciftcidefteri.web;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4107;
    private static final int MAX_WEATHER_BYTES = 1_500_000;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !"file".equals(uri.getScheme());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!"file:///android_asset/index.html".equals(url)) return;
                try {
                    String enhancements = readAssetText("phase3-core.js") + "\n"
                        + "window.effective=window.eff;window.renderAll=window.render;\n"
                        + readAssetText("phase3.js") + "\n"
                        + "if(window.renderAll)window.render=window.renderAll;\n"
                        + readAssetText("phase4-core.js") + "\n"
                        + readAssetText("phase4.js") + "\n"
                        + readAssetText("phase4-compat.js") + "\n"
                        + readAssetText("phase5-core.js") + "\n"
                        + readAssetText("phase5.js") + "\n"
                        + readAssetText("phase6-polish.js");
                    view.evaluateJavascript(enhancements, null);
                } catch (Exception ignored) {
                    // The base ledger stays usable even if an optional enhancement layer cannot load.
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    pendingFileChooser = null;
                    return false;
                }
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    private String readAssetText(String name) throws Exception {
        try (InputStream input = getAssets().open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingFileChooser == null) return;
        pendingFileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        pendingFileChooser = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void saveBackup(String content, String requestedName) {
            if (content == null || content.isEmpty() || content.length() > 8_000_000) {
                backupCallback(false, "yedek oluşturulamadı");
                return;
            }
            String filename = sanitizeFilename(requestedName);
            new Thread(() -> {
                try {
                    String saved = writeBackup(content, filename);
                    backupCallback(true, saved);
                } catch (Exception error) {
                    backupCallback(false, "dosya yazılamadı");
                }
            }).start();
        }

        @JavascriptInterface
        public void fetchWeather(String requestedLocation) {
            final String location = requestedLocation == null ? "" : requestedLocation.trim();
            if (location.length() < 2 || location.length() > 80) {
                weatherCallback(false, "weather_location_invalid");
                return;
            }
            new Thread(() -> {
                try {
                    weatherCallback(true, fetchWeatherPayload(location));
                } catch (Exception error) {
                    weatherCallback(false, "weather_unavailable");
                }
            }).start();
        }
    }

    private String fetchWeatherPayload(String location) throws Exception {
        String encoded = URLEncoder.encode(location, StandardCharsets.UTF_8.name());
        String geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encoded
            + "&count=1&language=tr&countryCode=TR&format=json";
        JSONObject geocoding = new JSONObject(readHttps(geoUrl));
        JSONArray results = geocoding.optJSONArray("results");
        if (results == null || results.length() == 0) throw new IllegalStateException("weather_location_not_found");
        JSONObject place = results.getJSONObject(0);
        double latitude = place.getDouble("latitude");
        double longitude = place.getDouble("longitude");

        String forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude="
            + String.format(Locale.US, "%.6f", latitude)
            + "&longitude=" + String.format(Locale.US, "%.6f", longitude)
            + "&current=temperature_2m,weather_code"
            + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max"
            + "&timezone=auto&forecast_days=3";
        JSONObject forecast = new JSONObject(readHttps(forecastUrl));

        JSONObject payload = new JSONObject();
        payload.put("name", place.optString("name", location));
        payload.put("admin1", place.optString("admin1", ""));
        payload.put("latitude", latitude);
        payload.put("longitude", longitude);
        payload.put("forecast", forecast);
        return payload.toString();
    }

    private String readHttps(String urlValue) throws Exception {
        URL url = new URL(urlValue);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new SecurityException("https_required");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(10_000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "TarlaPusula-Android/1.3");
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("weather_http_" + status);
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    if (output.size() > MAX_WEATHER_BYTES) throw new IllegalStateException("weather_response_too_large");
                }
                return output.toString(StandardCharsets.UTF_8.name());
            }
        } finally {
            connection.disconnect();
        }
    }

    private String writeBackup(String content, String filename) throws Exception {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CiftciDefteri");
            ContentResolver resolver = getContentResolver();
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException();
            try (OutputStream output = resolver.openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException();
                output.write(bytes);
            }
            return "İndirilenler/CiftciDefteri/" + filename;
        }
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) throw new IllegalStateException();
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException();
        File out = new File(dir, filename);
        try (FileOutputStream stream = new FileOutputStream(out, false)) {
            stream.write(bytes);
        }
        return out.getAbsolutePath();
    }

    private String sanitizeFilename(String value) {
        String fallback = "ciftci-defteri-yedek.json";
        if (value == null) return fallback;
        String cleaned = value.replaceAll("[^a-zA-Z0-9._-]", "-");
        if (cleaned.isEmpty() || cleaned.length() > 96) return fallback;
        if (!cleaned.endsWith(".json")) cleaned += ".json";
        return cleaned;
    }

    private void backupCallback(boolean ok, String message) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String safe = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ");
            webView.evaluateJavascript("window.onNativeBackupSaved&&window.onNativeBackupSaved(" + ok + ", '" + safe + "');", null);
        });
    }

    private void weatherCallback(boolean ok, String payload) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String quoted = JSONObject.quote(payload == null ? "" : payload);
            webView.evaluateJavascript("window.onNativeWeather&&window.onNativeWeather(" + ok + ", " + quoted + ");", null);
        });
    }
}
