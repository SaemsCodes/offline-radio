package com.orad.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import android.provider.Settings;
import android.content.Context;

@CapacitorPlugin(name = "MeshNetworking")
public class MeshNetworkingPlugin extends Plugin {
    
    private MeshRoutingManager routingManager;

    @Override
    public void load() {
        routingManager = new MeshRoutingManager(getDeviceId());
    }

    @PluginMethod
    public void discoverRoute(PluginCall call) {
        String dest = call.getString("destination");
        if (dest == null || dest.isEmpty()) {
            call.reject("Destination address is required");
            return;
        }
        
        RouteDiscoveryResult result = routingManager.discoverRoute(dest);
        call.resolve(convertToJS(result));
    }
    
    private String getDeviceId() {
        return Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ANDROID_ID
        );
    }
    
    private JSObject convertToJS(RouteDiscoveryResult result) {
        JSObject jsResult = new JSObject();
        jsResult.put("success", result.isSuccess());
        jsResult.put("deviceId", getDeviceId());
        
        if (result.isSuccess()) {
            JSObject routeInfo = new JSObject();
            routeInfo.put("destination", result.getDestination());
            routeInfo.put("nextHop", result.getNextHop());
            routeInfo.put("hopCount", result.getHopCount());
            routeInfo.put("latency", result.getLatency());
            jsResult.put("route", routeInfo);
        } else {
            jsResult.put("error", result.getErrorMessage());
        }
        
        return jsResult;
    }
}