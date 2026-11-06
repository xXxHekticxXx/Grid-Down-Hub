package com.xxxhekticxxx.griddownhub;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private String pendingRoute;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pendingRoute = getIntent() != null ? getIntent().getStringExtra("route") : null;
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String r = intent.getStringExtra("route");
        if (r != null) { pendingRoute = r; openRoute(0); }
    }

    @Override public void onResume() {
        super.onResume();
        CompassService.startIfWidgets(this);
        if (pendingRoute != null) openRoute(1200); // give the app a moment to load on a cold start
    }

    /** Opens a screen of the app, e.g. "/tool/compass" when the compass widget is tapped. */
    private void openRoute(long delayMs) {
        final String r = pendingRoute;
        pendingRoute = null;
        if (r == null || getBridge() == null) return;
        getBridge().getWebView().postDelayed(() ->
            getBridge().getWebView().evaluateJavascript("location.hash='#" + r.replace("'", "") + "'", null), delayMs);
    }
}
