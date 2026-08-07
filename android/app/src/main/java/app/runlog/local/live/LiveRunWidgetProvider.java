package app.runlog.local.live;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import app.runlog.local.MainActivity;
import app.runlog.local.R;

/**
 * Home-screen widget: time, distance, pace for the current (or last) run snapshot.
 */
public class LiveRunWidgetProvider extends AppWidgetProvider {

    public static void requestUpdate(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, LiveRunWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        if (ids == null || ids.length == 0) return;
        Intent intent = new Intent(context, LiveRunWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateOne(context, appWidgetManager, id);
        }
    }

    private void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_live_run);

        boolean active = LiveRunStore.isActive(context);
        String title = active
                ? (LiveRunStore.isPaused(context) ? "Paused" : "Live run")
                : "RunLog";
        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_time, LiveRunStore.time(context));
        views.setTextViewText(R.id.widget_distance, LiveRunStore.distance(context));
        views.setTextViewText(R.id.widget_pace, LiveRunStore.pace(context));

        String hr = LiveRunStore.hr(context);
        if (hr != null && !hr.isEmpty()) {
            views.setTextViewText(R.id.widget_hr, hr);
            views.setViewVisibility(R.id.widget_hr, android.view.View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_hr, android.view.View.GONE);
        }

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                context,
                appWidgetId,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pi);

        manager.updateAppWidget(appWidgetId, views);
    }
}
