package app.runlog.local.live;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
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

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermsCallback");
                return;
            }
        }
        applyStart(call);
    }

    @PermissionCallback
    private void notificationPermsCallback(PluginCall call) {
        applyStart(call);
    }

    private void applyStart(PluginCall call) {
        String title = call.getString("title", "RunLog");
        String time = call.getString("time", "0:00");
        String distance = call.getString("distance", "—");
        String pace = call.getString("pace", "--:--");
        String hr = call.getString("hr", "");
        boolean paused = Boolean.TRUE.equals(call.getBoolean("paused", false));

        LiveRunStore.write(getContext(), true, paused, title, time, distance, pace, hr);
        LiveRunService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", true));
        if (!active) {
            LiveRunStore.clear(getContext());
            LiveRunService.stop(getContext());
            call.resolve();
            return;
        }

        String title = call.getString("title", "RunLog");
        String time = call.getString("time", "0:00");
        String distance = call.getString("distance", "—");
        String pace = call.getString("pace", "--:--");
        String hr = call.getString("hr", "");
        boolean paused = Boolean.TRUE.equals(call.getBoolean("paused", false));

        LiveRunStore.write(getContext(), true, paused, title, time, distance, pace, hr);
        LiveRunService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        LiveRunStore.clear(getContext());
        LiveRunService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        JSObject out = new JSObject();
        out.put("active", LiveRunStore.isActive(getContext()));
        out.put("paused", LiveRunStore.isPaused(getContext()));
        out.put("title", LiveRunStore.title(getContext()));
        out.put("time", LiveRunStore.time(getContext()));
        out.put("distance", LiveRunStore.distance(getContext()));
        out.put("pace", LiveRunStore.pace(getContext()));
        out.put("hr", LiveRunStore.hr(getContext()));
        call.resolve(out);
    }
}
