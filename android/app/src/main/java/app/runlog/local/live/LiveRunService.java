package app.runlog.local.live;

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import app.runlog.local.MainActivity;
import app.runlog.local.R;

/**
 * Foreground service that keeps a live-run notification visible while the app
 * is minimized. Stats are pushed from JS via LiveRunPlugin → LiveRunStore.
 */
public class LiveRunService extends Service {
    private static final String TAG = "LiveRunService";
    public static final String CHANNEL_ID = "runlog_live_run";
    public static final int NOTIFICATION_ID = 7101;
    public static final String ACTION_START = "app.runlog.local.START_LIVE_RUN";
    public static final String ACTION_STOP = "app.runlog.local.STOP_LIVE_RUN";

    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    public static void start(Context context) {
        try {
            ensureChannel(context);
            Intent intent = new Intent(context, LiveRunService.class);
            intent.setAction(ACTION_START);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start live run service", e);
        }
    }

    public static void stop(Context context) {
        try {
            Intent intent = new Intent(context, LiveRunService.class);
            intent.setAction(ACTION_STOP);
            context.startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop live run service", e);
            try {
                context.stopService(new Intent(context, LiveRunService.class));
            } catch (Exception ignored) {
            }
            running = false;
        }
    }

    /** Push the latest SharedPreferences stats into the ongoing notification. */
    public static void refreshNotification(Context context) {
        if (!LiveRunStore.isActive(context)) return;
        try {
            ensureChannel(context);
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildNotification(context));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to refresh notification", e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            running = false;
            try {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } catch (Exception ignored) {
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            ensureChannel(this);
            Notification notification = buildNotification(this);
            // Location only — most reliable for a GPS run tracker.
            // (health FGS type can crash if the OS rejects the type combination.)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            running = true;
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            running = false;
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    static Notification buildNotification(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                0,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = LiveRunStore.title(context);
        if (LiveRunStore.isPaused(context)) {
            title = title + " · Paused";
        }
        String body = LiveRunStore.notificationBody(context);

        return new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(R.drawable.ic_stat_runlog)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Live run",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows distance, pace and time while a run is in progress");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }
}
