package com.xxxhekticxxx.griddownhub;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.widget.RemoteViews;

/**
 * Keeps the home-screen compass widgets turning. Reads the phone's rotation sensor while the screen is on,
 * corrects magnetic north to true north with Android's built-in World Magnetic Model (no internet), and
 * redraws the widgets a few times a second. Stops listening while the screen is off to save battery.
 */
public class CompassService extends Service implements SensorEventListener {
    static final String CHANNEL = "compass";
    static volatile boolean running = false;

    private SensorManager sensors;
    private Sensor rotation;
    private boolean listening = false;
    private float smooth = Float.NaN;
    private float lastDrawn = Float.NaN;
    private long lastDrawAt = 0;
    private float declination = 0f;
    private boolean haveDeclination = false;

    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) stopListening();
            else startListening();
        }
    };

    public static boolean hasWidgets(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        return m.getAppWidgetIds(new ComponentName(c, CompassWidget.class)).length > 0
            || m.getAppWidgetIds(new ComponentName(c, CompassWidgetSmall.class)).length > 0;
    }

    /** Called when the app opens: starting from the app is always allowed. */
    public static void startIfWidgets(Context c) {
        if (running || !hasWidgets(c)) return;
        try {
            Intent i = new Intent(c, CompassService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignored) { }
    }

    @Override public void onCreate() {
        super.onCreate();
        sensors = (SensorManager) getSystemService(SENSOR_SERVICE);
        rotation = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rotation == null) rotation = sensors.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screen, f, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(screen, f);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = notification();
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(7, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        running = true;
        if (!hasWidgets(this)) { stopSelf(); return START_NOT_STICKY; }
        updateDeclination();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null || pm.isInteractive()) startListening();
        draw(Float.NaN, true);
        return START_STICKY;
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Compass widget", NotificationManager.IMPORTANCE_MIN);
            ch.setDescription("Shown while the home screen compass is running");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return b.setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle("Compass widget is on")
            .setContentText("Turns only while the screen is on. Remove the widget to stop it.")
            .setContentIntent(CompassWidget.openApp(this))
            .setOngoing(true)
            .build();
    }

    private void updateDeclination() {
        double lat = 28.80, lon = -81.55, alt = 20; // Sorrento, FL until the phone has a GPS fix
        haveDeclination = false;
        try {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
                Location best = null;
                for (String p : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(p);
                    if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
                }
                if (best != null) { lat = best.getLatitude(); lon = best.getLongitude(); alt = best.getAltitude(); haveDeclination = true; }
            }
        } catch (Exception ignored) { }
        declination = new GeomagneticField((float) lat, (float) lon, (float) alt, System.currentTimeMillis()).getDeclination();
        haveDeclination = true; // the home-area value is still far better than none
    }

    private void startListening() {
        if (listening || rotation == null) return;
        sensors.registerListener(this, rotation, SensorManager.SENSOR_DELAY_UI);
        listening = true;
        updateDeclination();
    }

    private void stopListening() {
        if (!listening) return;
        sensors.unregisterListener(this);
        listening = false;
    }

    private final float[] rm = new float[9];
    private final float[] or = new float[3];

    @Override public void onSensorChanged(SensorEvent e) {
        SensorManager.getRotationMatrixFromVector(rm, e.values);
        SensorManager.getOrientation(rm, or);
        float mag = (float) Math.toDegrees(or[0]);
        float heading = ((mag + declination) % 360 + 360) % 360;
        if (Float.isNaN(smooth)) smooth = heading;
        else {
            float d = ((heading - smooth + 540) % 360) - 180; // shortest way round
            smooth = ((smooth + d * 0.25f) % 360 + 360) % 360;
        }
        long now = SystemClock.uptimeMillis();
        if (now - lastDrawAt < 120) return;
        if (!Float.isNaN(lastDrawn) && Math.abs(((smooth - lastDrawn + 540) % 360) - 180) < 1f) return;
        draw(smooth, false);
    }

    private void draw(float heading, boolean force) {
        lastDrawAt = SystemClock.uptimeMillis();
        lastDrawn = heading;
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        int[] big = m.getAppWidgetIds(new ComponentName(this, CompassWidget.class));
        int[] small = m.getAppWidgetIds(new ComponentName(this, CompassWidgetSmall.class));
        String label = rotation == null ? "No compass sensor" : (haveDeclination ? "true north" : "magnetic");
        if (big.length > 0) {
            RemoteViews v = CompassWidget.views(this, CompassRender.dial(heading, label, 300), true);
            m.updateAppWidget(big, v);
        }
        if (small.length > 0) {
            RemoteViews v = CompassWidgetSmall.views(this, heading, label, true);
            m.updateAppWidget(small, v);
        }
    }

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    @Override public void onDestroy() {
        running = false;
        stopListening();
        try { unregisterReceiver(screen); } catch (Exception ignored) { }
        // show "tap to start" again
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        m.updateAppWidget(new ComponentName(this, CompassWidget.class), CompassWidget.views(this, CompassRender.dial(Float.NaN, "Tap to start", 300), false));
        m.updateAppWidget(new ComponentName(this, CompassWidgetSmall.class), CompassWidgetSmall.views(this, Float.NaN, "Tap to start", false));
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
