package com.orad.app.network

import android.content.Context
import com.orad.app.mesh.MeshRoutingManager

class NodeDiscoveryService(
    private val context: Context,
    private val routingManager: MeshRoutingManager
) {
    private val wifiDirectManager = WifiDirectManager(context, routingManager)
    private val bleManager = BleManager(context, routingManager)
    
    fun startDiscovery() {
        wifiDirectManager.startDiscovery()
        bleManager.startScanning()
        
        // Schedule periodic neighbor pruning
        Handler(Looper.getMainLooper()).postDelayed(::checkNeighbors, 30_000)
    }
    
    private fun checkNeighbors() {
        routingManager.pruneExpiredNeighbors()
        Handler(Looper.getMainLooper()).postDelayed(::checkNeighbors, 30_000)
    }
    
    fun handleIncomingPacket(senderId: String, packet: ByteArray) {
        routingManager.updateNeighbor(senderId)
        // Add packet parsing and routing logic here
    }
}