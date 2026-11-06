package com.xxxhekticxxx.griddownhub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.widget.RemoteViews;

/** Round compass widget for the home screen (2x2). */
public class CompassWidget extends AppWidgetProvider {
    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("route", "/tool/compass");
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 71, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent startService(Context c) {
        Intent i = new Intent(c, CompassService.class);
        if (Build.VERSION.SDK_INT >= 26) return PendingIntent.getForegroundService(c, 72, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getService(c, 72, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static RemoteViews views(Context c, Bitmap dial, boolean live) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_compass);
        v.setImageViewBitmap(R.id.compass_dial, dial);
        v.setOnClickPendingIntent(R.id.compass_root, live ? openApp(c) : startService(c));
        return v;
    }

    static void kick(Context c) {
        try {
            Intent i = new Intent(c, CompassService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignored) {
            // Android may refuse to start it from here; the widget then says "Tap to start".
        }
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        if (!CompassService.running) {
            m.updateAppWidget(ids, views(c, CompassRender.dial(Float.NaN, "Tap to start", 300), false));
            kick(c);
        }
    }

    @Override public void onDisabled(Context c) {
        if (!CompassService.hasWidgets(c)) c.stopService(new Intent(c, CompassService.class));
    }
}
