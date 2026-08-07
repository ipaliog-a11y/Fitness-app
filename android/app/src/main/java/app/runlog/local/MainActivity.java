package app.runlog.local;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.runlog.local.live.LiveRunPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before super so the bridge picks up the local plugin.
        registerPlugin(LiveRunPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
