package com.orad.app;

public class RouteDiscoveryResult {
    private boolean success;
    private String errorMessage;
    private String destination;
    private String nextHop;
    private int hopCount;
    private long latency; // in milliseconds
    
    public RouteDiscoveryResult() {
        this.success = false;
    }
    
    // Getters and setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    
    public String getNextHop() { return nextHop; }
    public void setNextHop(String nextHop) { this.nextHop = nextHop; }
    
    public int getHopCount() { return hopCount; }
    public void setHopCount(int hopCount) { this.hopCount = hopCount; }
    
    public long getLatency() { return latency; }
    public void setLatency(long latency) { this.latency = latency; }
}