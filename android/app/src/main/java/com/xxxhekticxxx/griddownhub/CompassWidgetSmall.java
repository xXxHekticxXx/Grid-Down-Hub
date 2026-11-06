package com.xxxhekticxxx.griddownhub;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Slim compass widget: an arrow and the heading in degrees. */
public class CompassWidgetSmall extends AppWidgetProvider {
    static RemoteViews views(Context c, float heading, String label, boolean live) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_compass_small);
        v.setImageViewBitmap(R.id.compass_arrow, CompassRender.arrow(heading, 96));
        v.setTextViewText(R.id.compass_heading, Float.isNaN(heading) ? "Compass" : CompassRender.headingText(heading) + " " + CompassRender.cardinal(heading));
        v.setTextViewText(R.id.compass_label, label);
        v.setOnClickPendingIntent(R.id.compass_root, live ? CompassWidget.openApp(c) : CompassWidget.startService(c));
        return v;
    }

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        if (!CompassService.running) {
            m.updateAppWidget(ids, views(c, Float.NaN, "Tap to start", false));
            CompassWidget.kick(c);
        }
    }

    @Override public void onDisabled(Context c) {
        if (!CompassService.hasWidgets(c)) c.stopService(new Intent(c, CompassService.class));
    }
}
