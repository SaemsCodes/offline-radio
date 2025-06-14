package com.orad.app.mesh

import java.util.*
import kotlin.collections.HashMap
import kotlin.math.min

class MeshRoutingManager(private val localNodeId: String) {
    // Routing table: <Destination, RouteEntry>
    private val routingTable = HashMap<String, RouteEntry>()
    
    // Message history: <MessageID, TTL>
    private val messageHistory = HashMap<String, Long>()
    
    // Sequence numbers for route freshness
    private var sequenceNumber = Random().nextInt(1000)
        get() = field++
    
    // Neighbor nodes: <NodeID, LastSeenTimestamp>
    private val neighbors = HashMap<String, Long>()

    data class RouteEntry(
        val destination: String,
        val nextHop: String,
        val hopCount: Int,
        val sequenceNum: Int,
        val lastUpdated: Long = System.currentTimeMillis()
    )

    data class RouteRequest(
        val source: String,
        val destination: String,
        val requestId: Int,
        val hopCount: Int = 0,
        val sequenceNum: Int
    )

    data class MeshMessage(
        val messageId: String = UUID.randomUUID().toString(),
        val source: String,
        val destination: String, // "broadcast" for broadcast messages
        val payload: ByteArray,
        val timestamp: Long = System.currentTimeMillis(),
        val ttl: Int = DEFAULT_TTL
    )

    companion object {
        const val DEFAULT_TTL = 10
        const val ROUTE_TIMEOUT = 60_000 // 60 seconds
        const val NEIGHBOR_TIMEOUT = 30_000 // 30 seconds
    }

    // Handle incoming route requests
    fun handleRouteRequest(rreq: RouteRequest, fromPeer: String) {
        // Update neighbor status
        updateNeighbor(fromPeer)
        
        // Check if we have a fresh route
        val localSeq = sequenceNumber
        val currentRoute = routingTable[rreq.destination]
        
        if (currentRoute == null || currentRoute.sequenceNum < rreq.sequenceNum) {
            // Forward request to neighbors
            broadcastRouteRequest(rreq.copy(hopCount = rreq.hopCount + 1))
        } else if (currentRoute.sequenceNum >= rreq.sequenceNum) {
            // Send route reply back through the path
            sendRouteReply(rreq.source, currentRoute)
        }
    }

    // Broadcast message to all reachable nodes
    fun broadcastMessage(message: MeshMessage) {
        if (messageHistory.containsKey(message.messageId)) return
        
        messageHistory[message.messageId] = System.currentTimeMillis()
        neighbors.keys.forEach { neighbor ->
            forwardMessage(message.copy(ttl = message.ttl - 1), neighbor)
        }
    }

    // Forward message to specific next hop
    fun forwardMessage(message: MeshMessage, nextHop: String) {
        if (message.ttl <= 0) return
        // Actual sending happens through network plugin
    }

    // Update neighbor status
    fun updateNeighbor(nodeId: String) {
        neighbors[nodeId] = System.currentTimeMillis()
        pruneExpiredNeighbors()
    }

    // Route discovery
    fun discoverRoute(destination: String) {
        val rreq = RouteRequest(
            source = localNodeId,
            destination = destination,
            requestId = Random().nextInt(),
            sequenceNum = sequenceNumber
        )
        broadcastRouteRequest(rreq)
    }

    private fun broadcastRouteRequest(rreq: RouteRequest) {
        // Implementation would send through network interface
    }

    private fun sendRouteReply(destination: String, route: RouteEntry) {
        // Implementation would send through network interface
    }

    private fun pruneExpiredNeighbors() {
        val now = System.currentTimeMillis()
        neighbors.entries.removeAll { (_, timestamp) ->
            now - timestamp > NEIGHBOR_TIMEOUT
        }
    }

    fun getRoute(destination: String): RouteEntry? {
        return routingTable[destination]?.takeIf {
            System.currentTimeMillis() - it.lastUpdated < ROUTE_TIMEOUT
        }
    }

    fun getConnectedNeighbors(): Set<String> {
        pruneExpiredNeighbors()
        return neighbors.keys
    }
}