import type {
  WebSocketEvent,
  OcppCommandResponse,
  RemoteStartTransactionPayload,
  RemoteStopTransactionPayload,
} from "./types"

// Mock WebSocket for development
export class MockWebSocket {
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> = new Map()
  private intervalId: NodeJS.Timeout | null = null
  private activeTransactions: Map<string, string> = new Map() // connectorKey -> transactionId

  connect() {
    console.log("[MockWebSocket] Connected")

    // Simulate periodic updates
    this.intervalId = setInterval(() => {
      this.simulateRandomEvent()
    }, 5000)
  }

  disconnect() {
    console.log("[MockWebSocket] Disconnected")
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  on(event: string, callback: (event: WebSocketEvent) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (event: WebSocketEvent) => void) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  async sendCommand(
    chargePointId: string,
    action: "RemoteStartTransaction" | "RemoteStopTransaction",
    payload: RemoteStartTransactionPayload | RemoteStopTransactionPayload,
  ): Promise<OcppCommandResponse> {
    console.log(`[MockWebSocket] Sending ${action} to ${chargePointId}`, payload)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simulate 90% success rate
    const isSuccess = Math.random() > 0.1

    if (action === "RemoteStartTransaction") {
      const startPayload = payload as RemoteStartTransactionPayload
      const connectorKey = `${chargePointId}-${startPayload.connectorId}`

      if (isSuccess) {
        const transactionId = `txn-${Date.now()}`
        this.activeTransactions.set(connectorKey, transactionId)

        // Emit transaction started event after a short delay
        setTimeout(() => {
          this.emit({
            event: "transaction.started",
            data: {
              chargePointId,
              connectorId: startPayload.connectorId,
              transactionId,
              idTag: startPayload.idTag,
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          })

          // Emit status change to Occupied
          this.emit({
            event: "connector.statusChanged",
            data: {
              chargePointId,
              connectorId: startPayload.connectorId,
              status: "Occupied",
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          })
        }, 500)

        return {
          status: "Accepted",
          transactionId,
        }
      } else {
        return {
          status: "Rejected",
          errorMessage: "Connector is not available",
        }
      }
    } else if (action === "RemoteStopTransaction") {
      const stopPayload = payload as RemoteStopTransactionPayload

      console.log("[v0] Stopping transaction", stopPayload.transactionId)
      console.log("[v0] Active transactions:", Array.from(this.activeTransactions.entries()))

      if (isSuccess) {
        let connectorKey: string | null = null
        let connectorId: number | null = null

        for (const [key, txnId] of this.activeTransactions.entries()) {
          if (txnId === stopPayload.transactionId) {
            connectorKey = key
            break
          }
        }

        console.log("[v0] Found connector key:", connectorKey)

        if (connectorKey) {
          this.activeTransactions.delete(connectorKey)
          const [cpId, connId] = connectorKey.split("-")
          connectorId = Number.parseInt(connId)

          console.log("[v0] Emitting transaction.stopped for", cpId, "connector", connectorId)

          this.emit({
            event: "transaction.stopped",
            data: {
              chargePointId: cpId,
              transactionId: stopPayload.transactionId,
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          })

          // Emit status change to Available
          this.emit({
            event: "connector.statusChanged",
            data: {
              chargePointId: cpId,
              connectorId: connectorId,
              status: "Available",
              errorCode: "NoError",
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          })
        } else {
          console.log("[v0] Transaction not found in active transactions")
        }

        return {
          status: "Accepted",
        }
      } else {
        return {
          status: "Rejected",
          errorMessage: "Transaction not found or already stopped",
        }
      }
    }

    return {
      status: "Rejected",
      errorMessage: "Unknown command",
    }
  }

  private emit(event: WebSocketEvent) {
    const listeners = this.listeners.get(event.event)
    if (listeners) {
      listeners.forEach((callback) => callback(event))
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.listeners.get("*")
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => callback(event))
    }
  }

  private simulateRandomEvent() {
    // Status changes to Occupied should only happen via RemoteStartTransaction
    const chargePointId = `cp-00${Math.floor(Math.random() * 4) + 1}`
    const connectorId = Math.floor(Math.random() * 4) + 1
    const connectorKey = `${chargePointId}-${connectorId}`

    // Check if this connector has an active transaction
    const hasActiveTransaction = this.activeTransactions.has(connectorKey)

    if (hasActiveTransaction) {
      // If connector is occupied, send meter values
      const prevSoc = Math.min(100, Math.floor((Date.now() / 30000) % 101)) // deterministic slow increase
      this.emit({
        event: "meter.values",
        data: {
          chargePointId,
          connectorId,
          power_kW: 20 + (Date.now() % 10000) / 1000, // pseudo varying but deterministic
          voltage_V: 400,
          current_A: 60,
          soc_percent: prevSoc,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      })
    } else {
      // If connector is available, occasionally send status updates or meter values for idle state
      const eventType = Math.random() > 0.5 ? "status" : "meter"

      if (eventType === "status") {
        // Only send Available or Faulted status (not Occupied without transaction)
        const status = Math.random() > 0.98 ? "Faulted" : "Available"
        this.emit({
          event: "connector.statusChanged",
          data: {
            chargePointId,
            connectorId,
            status,
            errorCode: status === "Faulted" ? "ConnectorLockFailure" : "NoError",
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        })
      } else {
        // Send idle meter values (zero power)
        this.emit({
          event: "meter.values",
          data: {
            chargePointId,
            connectorId,
            power_kW: 0,
            voltage_V: 380 + Math.random() * 20,
            current_A: 0,
            soc_percent: null,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        })
      }
    }
  }
}

// Singleton instance
let mockWsInstance: MockWebSocket | null = null

export function getMockWebSocket(): MockWebSocket {
  if (!mockWsInstance) {
    mockWsInstance = new MockWebSocket()
  }
  return mockWsInstance
}
