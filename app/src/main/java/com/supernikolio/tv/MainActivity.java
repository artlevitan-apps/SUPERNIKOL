package com.supernikolio.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;

/** Lightweight offline fullscreen TV shell: no ads, network calls or touch requirement. */
public class MainActivity extends Activity {
    private WebView game;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                             WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(18,30,51));
        game.setFocusable(true);
        game.setFocusableInTouchMode(true);
        game.setWebViewClient(new WebViewClient());
        WebSettings cfg = game.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setAllowFileAccess(true);
        cfg.setMediaPlaybackRequiresUserGesture(false);
        cfg.setDefaultTextEncodingName("UTF-8");
        cfg.setCacheMode(WebSettings.LOAD_NO_CACHE);
        setContentView(game);
        game.loadUrl("file:///android_asset/index.html");
        game.requestFocus();
    }

    private String keyName(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP: return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "ArrowRight";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER: return "Enter";
            case KeyEvent.KEYCODE_BACK: return "Escape";
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return "MediaPlayPause";
            default: return null;
        }
    }

    private boolean dispatchToGame(KeyEvent event, boolean down) {
        String name = keyName(event.getKeyCode());
        if (name == null || game == null) return false;
        boolean repeat = event.getRepeatCount() > 0;
        String script = "window.dispatchEvent(new KeyboardEvent('" + (down ? "keydown" : "keyup")
                + "',{key:'" + name + "',code:'" + name
                + "',bubbles:true,cancelable:true,repeat:" + repeat + "}));";
        game.evaluateJavascript(script, null);
        return true;
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && dispatchToGame(event, true)) return true;
        if (event.getAction() == KeyEvent.ACTION_UP && dispatchToGame(event, false)) return true;
        return super.dispatchKeyEvent(event);
    }

    @Override protected void onPause() {
        if (game != null) game.evaluateJavascript("window.dispatchEvent(new Event('blur'));", null);
        super.onPause();
    }

    @Override protected void onDestroy() {
        if (game != null) { game.destroy(); game = null; }
        super.onDestroy();
    }
}
