package ph.kalma.offline;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){registerPlugin(OfflineLLMPlugin.class);super.onCreate(state);}
}