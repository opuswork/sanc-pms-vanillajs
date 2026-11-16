package com.syncheon.pms;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
public class MainActivity extends Activity {
  private static final String UPDATE_FILE = "app_update.html";
  private static final int REQ_PICK = 1001;
  private WebView wv;
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 23) {
      getWindow().setStatusBarColor(0xFFFFFFFF);
      getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    }
    wv = new WebView(this);
    WebSettings s = wv.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(true);
    s.setAllowContentAccess(true);
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(false);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setTextZoom(100);
    wv.setBackgroundColor(0xFFFFFFFF);
    wv.setWebViewClient(new WebViewClient());
    wv.addJavascriptInterface(new Bridge(this), "AndroidBridge");
    setContentView(wv);
    loadApp();
  }

  void loadApp() {
    String html;
    File uf = new File(getFilesDir(), UPDATE_FILE);
    if (uf.exists()) {
      String h = readFile(uf);
      html = (h != null && h.length() > 500) ? h : readAsset("app.html");
    } else {
      html = readAsset("app.html");
    }
    wv.loadDataWithBaseURL("https://syncheon.app/", html, "text/html", "UTF-8", null);
  }

  static String readFile(File f) {
    try {
      FileInputStream in = new FileInputStream(f);
      ByteArrayOutputStream bo = new ByteArrayOutputStream();
      byte[] b = new byte[8192]; int r;
      while ((r = in.read(b)) > 0) bo.write(b, 0, r);
      in.close();
      return bo.toString("UTF-8");
    } catch (Exception e) { return null; }
  }

  static String metaVersion(String html) {
    if (html == null) return null;
    java.util.regex.Matcher m = java.util.regex.Pattern
      .compile("<meta\\s+name=\"app-version\"\\s+content=\"([^\"]+)\"")
      .matcher(html);
    return m.find() ? m.group(1) : null;
  }

  @Override protected void onActivityResult(int req, int res, android.content.Intent data) {
    if (req == REQ_PICK && res == RESULT_OK && data != null && data.getData() != null) {
      try {
        InputStream is = getContentResolver().openInputStream(data.getData());
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] b = new byte[8192]; int r;
        while ((r = is.read(b)) > 0) bo.write(b, 0, r);
        is.close();
        final String html = bo.toString("UTF-8");
        if (html.length() < 2000 || html.indexOf("syncheon") < 0 && html.indexOf("AndroidBridge") < 0 && html.indexOf("app-version") < 0) {
          android.widget.Toast.makeText(this, "앱 파일이 아닙니다 (크기 " + html.length() + "바이트)", android.widget.Toast.LENGTH_LONG).show();
          return;
        }
        final String ver = metaVersion(html);
        final String name = queryName(data.getData());
        final int kb = html.getBytes("UTF-8").length / 1024;
        new android.app.AlertDialog.Builder(this)
          .setTitle("업데이트 파일 확인")
          .setMessage("파일 : " + (name == null ? "(이름 없음)" : name)
            + "\n\n버전 : " + (ver == null ? "확인 불가" : "v" + ver)
            + "\n\n크기 : " + kb + " KB"
            + "\n\n이 파일로 화면을 교체할까요?")
          .setPositiveButton("적용", new android.content.DialogInterface.OnClickListener() {
            public void onClick(android.content.DialogInterface d, int w) { applyUpdate(html, ver); }
          })
          .setNegativeButton("취소", null)
          .show();
      } catch (Exception e) {
        android.widget.Toast.makeText(this, "파일 읽기 실패: " + e.getMessage(), android.widget.Toast.LENGTH_LONG).show();
      }
    } else {
      super.onActivityResult(req, res, data);
    }
  }

  void applyUpdate(String html, String ver) {
    try {
      File f = new File(getFilesDir(), UPDATE_FILE);
      FileOutputStream o = new FileOutputStream(f);
      o.write(html.getBytes("UTF-8")); o.flush(); o.close();
      String back = readFile(f);
      if (back == null || back.length() != html.length()) {
        android.widget.Toast.makeText(this, "저장 검증 실패 — 다시 시도해 주세요", android.widget.Toast.LENGTH_LONG).show();
        return;
      }
      android.widget.Toast.makeText(this, "적용 완료 · " + (ver == null ? "?" : "v" + ver) + " · " + (back.length() / 1024) + "KB 저장됨", android.widget.Toast.LENGTH_LONG).show();
      loadApp();
    } catch (Exception e) {
      android.widget.Toast.makeText(this, "저장 실패: " + e.getMessage(), android.widget.Toast.LENGTH_LONG).show();
    }
  }

  String queryName(android.net.Uri uri) {
    try {
      android.database.Cursor c = getContentResolver().query(uri, null, null, null, null);
      if (c != null) {
        int i = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
        if (c.moveToFirst() && i >= 0) { String n = c.getString(i); c.close(); return n; }
        c.close();
      }
    } catch (Exception e) {}
    return null;
  }

  void openPicker() {
    try {
      android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT);
      i.addCategory(android.content.Intent.CATEGORY_OPENABLE);
      i.setType("*/*");
      i.putExtra(android.content.Intent.EXTRA_MIME_TYPES, new String[]{"text/html","text/plain","application/octet-stream"});
      startActivityForResult(i, REQ_PICK);
    } catch (Exception e) {
      android.widget.Toast.makeText(this, "파일 선택기를 열 수 없습니다", android.widget.Toast.LENGTH_LONG).show();
    }
  }

  public String readAssetPublic(String n) { return readAsset(n); }

  private String readAsset(String n) {
    try {
      InputStream is = getAssets().open(n);
      ByteArrayOutputStream bo = new ByteArrayOutputStream();
      byte[] buf = new byte[8192]; int r;
      while ((r = is.read(buf)) > 0) bo.write(buf, 0, r);
      is.close();
      return new String(bo.toByteArray(), "UTF-8");
    } catch (IOException e) { return "<h1>asset load error</h1>"; }
  }
  @Override public boolean onKeyDown(int c, KeyEvent e) {
    if (c == KeyEvent.KEYCODE_BACK && wv.canGoBack()) { wv.goBack(); return true; }
    return super.onKeyDown(c, e);
  }
  public static class Bridge {
    private final Context ctx;
    Bridge(Context c) { ctx = c; }
    @JavascriptInterface public String readData(String k) {
      try {
        File f = new File(ctx.getFilesDir(), "pms_" + k + ".json");
        if (!f.exists()) return null;
        FileInputStream in = new FileInputStream(f);
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] b = new byte[8192]; int r;
        while ((r = in.read(b)) > 0) bo.write(b, 0, r);
        in.close();
        return bo.toString("UTF-8");
      } catch (Exception e) { return null; }
    }
    @JavascriptInterface public boolean writeData(String k, String v) {
      try {
        File f = new File(ctx.getFilesDir(), "pms_" + k + ".json");
        FileOutputStream o = new FileOutputStream(f);
        o.write(v.getBytes("UTF-8")); o.close();
        return true;
      } catch (Exception e) { return false; }
    }
    @JavascriptInterface public String updateInfo() {
      MainActivity a = (MainActivity) ctx;
      File uf = new File(ctx.getFilesDir(), UPDATE_FILE);
      String upd = uf.exists() ? MainActivity.metaVersion(MainActivity.readFile(uf)) : null;
      String cur = MainActivity.metaVersion(MainActivity.readFile(uf));
      String bundled = MainActivity.metaVersion(a.readAssetPublic("app.html"));
      if (upd != null && upd.length() == 0) upd = null;
      String running = upd != null ? upd : bundled;
      String sz = "" + (uf.exists() ? uf.length() / 1024 : 0);
      return "{\"native\":true,\"kb\":\"" + sz + "\",\"ver\":\"" + (running == null ? "?" : running)
        + "\",\"bundled\":\"" + (bundled == null ? "?" : bundled)
        + "\",\"update\":\"" + (upd == null ? "" : upd) + "\"}";
    }
    @JavascriptInterface public void pickUpdate() {
      MainActivity a = (MainActivity) ctx;
      a.runOnUiThread(new Runnable() { public void run() { ((MainActivity) ctx).openPicker(); } });
    }
    @JavascriptInterface public void revertUpdate() {
      MainActivity a = (MainActivity) ctx;
      File uf = new File(ctx.getFilesDir(), UPDATE_FILE);
      if (uf.exists()) uf.delete();
      a.runOnUiThread(new Runnable() { public void run() { ((MainActivity) ctx).loadApp(); } });
    }
    @JavascriptInterface public String saveFile(String name, String content) {
      try {
        byte[] data = content.getBytes("UTF-8");
        String mime = name.endsWith(".csv") ? "text/csv" : "application/json";
        if (Build.VERSION.SDK_INT >= 29) {
          ContentValues cv = new ContentValues();
          cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
          cv.put(MediaStore.Downloads.MIME_TYPE, mime);
          cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SynCheon");
          cv.put(MediaStore.Downloads.IS_PENDING, 1);
          Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
          if (uri == null) return null;
          OutputStream os = ctx.getContentResolver().openOutputStream(uri);
          os.write(data); os.close();
          cv.clear(); cv.put(MediaStore.Downloads.IS_PENDING, 0);
          ctx.getContentResolver().update(uri, cv, null, null);
          return "다운로드/SynCheon/" + name;
        } else {
          File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "SynCheon");
          if (!dir.exists()) dir.mkdirs();
          File f = new File(dir, name);
          FileOutputStream fo = new FileOutputStream(f);
          fo.write(data); fo.close();
          return f.getAbsolutePath();
        }
      } catch (Exception e) { return null; }
    }
  }
}
