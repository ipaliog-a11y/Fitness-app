package app.runlog.local.live;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * JS bridge: start/stop live-run foreground notification and push stats
 * (also feeds the home-screen widget via LiveRunStore).
 */
@CapacitorPlugin(
        name = "LiveRun",
        permissions = {
                @Permission(
                        alias = "notifications",
                        strings = { Manifest.permission.POST_NOTIFICATIONS }
                )
        }
)
public class LiveRunPlugin extends Plugin {
    private static final String TAG = "LiveRunPlugin";

    @PluginMethod
    public void start(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissionForAlias("notifications", call, "notificationPermsCallback");
                    return;
                }
            }
            applyStart(call);
        } catch (Exception e) {
            Log.e(TAG, "start failed", e);
            // Never crash the WebView bridge — resolve so JS continues.
            call.resolve();
        }
    }

    @PermissionCallback
    private void notificationPermsCallback(PluginCall call) {
        try {
            applyStart(call);
        } catch (Exception e) {
            Log.e(TAG, "start after permission failed", e);
            call.resolve();
        }
    }

    private void applyStart(PluginCall call) {
        writeFromCall(call, true);
        if (!LiveRunService.isRunning()) {
            LiveRunService.start(getContext());
        } else {
            LiveRunService.refreshNotification(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        try {
            boolean active = true;
            if (call.getData() != null && call.getData().has("active")) {
                active = Boolean.TRUE.equals(call.getBoolean("active"));
            }
            if (!active) {
                LiveRunStore.clear(getContext());
                LiveRunService.stop(getContext());
                call.resolve();
                return;
            }

            writeFromCall(call, true);

            // Do NOT restart the service every tick — that was crashing the app.
            if (!LiveRunService.isRunning()) {
                LiveRunService.start(getContext());
            } else {
                LiveRunService.refreshNotification(getContext());
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "update failed", e);
            call.resolve();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            LiveRunStore.clear(getContext());
            LiveRunService.stop(getContext());
        } catch (Exception e) {
            Log.e(TAG, "stop failed", e);
        }
        call.resolve();
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        JSObject out = new JSObject();
        try {
            out.put("active", LiveRunStore.isActive(getContext()));
            out.put("paused", LiveRunStore.isPaused(getContext()));
            out.put("title", LiveRunStore.title(getContext()));
            out.put("time", LiveRunStore.time(getContext()));
            out.put("distance", LiveRunStore.distance(getContext()));
            out.put("pace", LiveRunStore.pace(getContext()));
            out.put("hr", LiveRunStore.hr(getContext()));
        } catch (Exception e) {
            Log.e(TAG, "getSnapshot failed", e);
        }
        call.resolve(out);
    }

    private void writeFromCall(PluginCall call, boolean active) {
        String title = str(call, "title", "RunLog");
        String time = str(call, "time", "0:00");
        String distance = str(call, "distance", "—");
        String pace = str(call, "pace", "--:--");
        String hr = str(call, "hr", "");
        boolean paused = false;
        try {
            if (call.getData() != null && call.getData().has("paused")) {
                paused = Boolean.TRUE.equals(call.getBoolean("paused"));
            }
        } catch (Exception ignored) {
        }
        LiveRunStore.write(getContext(), active, paused, title, time, distance, pace, hr);
    }

    private static String str(PluginCall call, String key, String fallback) {
        try {
            String v = call.getString(key);
            return v != null ? v : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }
}
