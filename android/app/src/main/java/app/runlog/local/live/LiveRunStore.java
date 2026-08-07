package app.runlog.local.live;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Shared run snapshot for the notification service and home-screen widget.
 * Written from the Capacitor plugin (JS); read by LiveRunService / widget.
 */
public final class LiveRunStore {
    public static final String PREFS = "runlog_live_run";

    public static final String KEY_ACTIVE = "active";
    public static final String KEY_PAUSED = "paused";
    public static final String KEY_TITLE = "title";
    public static final String KEY_TIME = "time";
    public static final String KEY_DISTANCE = "distance";
    public static final String KEY_PACE = "pace";
    public static final String KEY_HR = "hr";
    public static final String KEY_UPDATED_AT = "updatedAt";

    private LiveRunStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void write(
            Context context,
            boolean active,
            boolean paused,
            String title,
            String time,
            String distance,
            String pace,
            String hr
    ) {
        prefs(context)
                .edit()
                .putBoolean(KEY_ACTIVE, active)
                .putBoolean(KEY_PAUSED, paused)
                .putString(KEY_TITLE, title != null ? title : "RunLog")
                .putString(KEY_TIME, time != null ? time : "0:00")
                .putString(KEY_DISTANCE, distance != null ? distance : "—")
                .putString(KEY_PACE, pace != null ? pace : "--:--")
                .putString(KEY_HR, hr != null ? hr : "")
                .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
                .apply();

        LiveRunWidgetProvider.requestUpdate(context);
        if (active) {
            LiveRunService.refreshNotification(context);
        }
    }

    public static void clear(Context context) {
        write(context, false, false, "RunLog", "0:00", "—", "--:--", "");
    }

    public static boolean isActive(Context context) {
        return prefs(context).getBoolean(KEY_ACTIVE, false);
    }

    public static boolean isPaused(Context context) {
        return prefs(context).getBoolean(KEY_PAUSED, false);
    }

    public static String title(Context context) {
        return prefs(context).getString(KEY_TITLE, "RunLog");
    }

    public static String time(Context context) {
        return prefs(context).getString(KEY_TIME, "0:00");
    }

    public static String distance(Context context) {
        return prefs(context).getString(KEY_DISTANCE, "—");
    }

    public static String pace(Context context) {
        return prefs(context).getString(KEY_PACE, "--:--");
    }

    public static String hr(Context context) {
        return prefs(context).getString(KEY_HR, "");
    }

    public static String notificationBody(Context context) {
        String d = distance(context);
        String p = pace(context);
        String t = time(context);
        String h = hr(context);
        StringBuilder sb = new StringBuilder();
        sb.append(d).append(" · ").append(p).append(" · ").append(t);
        if (h != null && !h.isEmpty()) {
            sb.append(" · ").append(h);
        }
        if (isPaused(context)) {
            sb.append(" · Paused");
        }
        return sb.toString();
    }
}
