package com.orad.app.plugins

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.orad.app.mesh.MeshRoutingManager
import com.orad.app.mesh.NodeDiscoveryService

@CapacitorPlugin(name = "MeshNetworking")
class MeshNetworkingPlugin : Plugin() {
    private lateinit var routingManager: MeshRoutingManager
    private lateinit var discoveryService: NodeDiscoveryService

    override fun load() {
        // Initialize with unique device ID
        val deviceId = "NODE-${Build.SERIAL}"
        routingManager = MeshRoutingManager(deviceId)
        discoveryService = NodeDiscoveryService(context, routingManager)
        
        // Start discovery
        discoveryService.startDiscovery()
    }

    @PluginMethod
    fun getConnectedPeers(call: PluginCall) {
        try {
            val peers = routingManager.getConnectedNeighbors().toList()
            call.resolve(mapOf("peers" to peers))
        } catch (e: Exception) {
            call.reject("Peer discovery failed", e)
        }
    }

    @PluginMethod
    fun sendMessage(call: PluginCall) {
        try {
            val message = call.getObject("message")
            val destination = call.getString("destination", "broadcast")
            
            if (destination == "broadcast") {
                routingManager.broadcastMessage(
                    MeshRoutingManager.MeshMessage(
                        source = routingManager.localNodeId,
                        destination = destination,
                        payload = message.toString().toByteArray()
                    )
                )
            } else {
                // Unicast implementation
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Message send failed", e)
        }
    }

    @PluginMethod
    fun discoverRoute(call: PluginCall) {
        val destination = call.getString("destination") ?: return call.reject("Destination required")
        routingManager.discoverRoute(destination)
        call.resolve()
    }
}