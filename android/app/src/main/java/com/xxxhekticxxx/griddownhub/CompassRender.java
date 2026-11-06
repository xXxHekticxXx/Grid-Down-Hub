package com.xxxhekticxxx.griddownhub;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;

/** Draws the widget compass: a dial that turns so N always points north, with the heading in the middle. */
final class CompassRender {
    private CompassRender() { }

    static String cardinal(float deg) {
        String[] c = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };
        return c[Math.round(((deg % 360) + 360) % 360 / 45f) % 8];
    }

    static String headingText(float deg) {
        return Float.isNaN(deg) ? "—" : Math.round(((deg % 360) + 360) % 360) % 360 + "°";
    }

    static Bitmap dial(float heading, String label, int size) {
        Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        float s = size / 200f;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.argb(238, 0x16, 0x1A, 0x17));
        c.drawRoundRect(new RectF(0, 0, size, size), 34 * s, 34 * s, p);

        float cx = size / 2f, cy = size / 2f;
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(4 * s);
        p.setColor(Color.WHITE);
        c.drawCircle(cx, cy, 78 * s, p);

        c.save();
        if (!Float.isNaN(heading)) c.rotate(-heading, cx, cy);
        p.setStrokeWidth(2.5f * s);
        p.setColor(Color.argb(200, 255, 255, 255));
        for (int i = 0; i < 36; i++) {
            c.save();
            c.rotate(i * 10, cx, cy);
            c.drawLine(cx, cy - 78 * s, cx, cy - (i % 9 == 0 ? 66 : 71) * s, p);
            c.restore();
        }
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setTextAlign(Paint.Align.CENTER);
        t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        String[] d = { "N", "E", "S", "W" };
        for (int i = 0; i < 4; i++) {
            c.save();
            c.rotate(i * 90, cx, cy);
            t.setColor(i == 0 ? Color.rgb(0xFF, 0x5A, 0x4A) : Color.WHITE);
            t.setTextSize((i == 0 ? 22 : 18) * s);
            c.drawText(d[i], cx, cy - 46 * s, t);
            c.restore();
        }
        c.restore();

        // fixed pointer at the top: the way the phone is facing
        Paint f = new Paint(Paint.ANTI_ALIAS_FLAG);
        f.setColor(Color.WHITE);
        Path tri = new Path();
        tri.moveTo(cx, cy - 92 * s);
        tri.lineTo(cx + 8 * s, cy - 77 * s);
        tri.lineTo(cx - 8 * s, cy - 77 * s);
        tri.close();
        c.drawPath(tri, f);

        t.setColor(Color.WHITE);
        t.setTextSize(32 * s);
        c.drawText(headingText(heading), cx, cy + 10 * s, t);
        t.setTypeface(Typeface.DEFAULT);
        t.setTextSize(14 * s);
        t.setColor(Color.rgb(0xCF, 0xD8, 0xCF));
        c.drawText(Float.isNaN(heading) ? label : cardinal(heading) + " · " + label, cx, cy + 32 * s, t);
        return b;
    }

    /** Small arrow for the slim widget: points to north. */
    static Bitmap arrow(float heading, int size) {
        Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        float cx = size / 2f, cy = size / 2f, r = size * 0.42f;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(size * 0.05f);
        p.setColor(Color.WHITE);
        c.drawCircle(cx, cy, r, p);
        c.save();
        if (!Float.isNaN(heading)) c.rotate(-heading, cx, cy);
        Paint red = new Paint(Paint.ANTI_ALIAS_FLAG);
        red.setColor(Color.rgb(0xFF, 0x5A, 0x4A));
        Path n = new Path();
        n.moveTo(cx, cy - r * 0.85f);
        n.lineTo(cx + r * 0.28f, cy);
        n.lineTo(cx - r * 0.28f, cy);
        n.close();
        c.drawPath(n, red);
        Paint w = new Paint(Paint.ANTI_ALIAS_FLAG);
        w.setColor(Color.WHITE);
        Path sp = new Path();
        sp.moveTo(cx, cy + r * 0.85f);
        sp.lineTo(cx + r * 0.28f, cy);
        sp.lineTo(cx - r * 0.28f, cy);
        sp.close();
        c.drawPath(sp, w);
        c.restore();
        return b;
    }
}
