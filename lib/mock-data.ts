import type { ChargePoint, Connector, Transaction, ConnectorStatus } from "./types"

// Mock data generator for development without backend

// Create a seeded random number generator to ensure consistency
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function generateMockConnector(
  chargePointId: string,
  connectorId: number,
  status: ConnectorStatus = "Available",
): Connector {
  // Force all connectors to start Available with zero metrics
  const isOccupied = false

  // Use a deterministic seed based on chargePointId and connectorId
  const seed = chargePointId.length * 1000 + connectorId
  const random1 = seededRandom(seed)
  const random2 = seededRandom(seed + 1)
  const random3 = seededRandom(seed + 2)
  const random4 = seededRandom(seed + 3)
  const random5 = seededRandom(seed + 4)

  return {
    id: Math.floor(random1 * 10000),
    connectorId,
    chargePointId,
    status: 'Available',
    currentTransactionId: null,
    powerLimit_kW: 50,
    currentPower_kW: 0,
    voltage_V: 0,
    current_A: 0,
    soc_percent: 0,
    errorCode: null,
    lastUpdated: new Date(2024, 0, 1, 12, 0, 0).toISOString(),
  }
}

export function generateMockChargePoint(id: string, name: string, location: string): ChargePoint {
  const statuses: ConnectorStatus[] = ["Available", "Available", "Available", "Available"]

  return {
    id,
    name,
    location,
    firmwareVersion: "2.1.5",
    status: "online",
    lastSeen: new Date(2024, 0, 1, 12, 0, 0).toISOString(),
    model: "ChargePoint Express 250",
    vendor: "ChargePoint",
    connectors: [
      generateMockConnector(id, 1, statuses[0]),
      generateMockConnector(id, 2, statuses[1]),
      generateMockConnector(id, 3, statuses[2]),
      generateMockConnector(id, 4, statuses[3]),
    ],
  }
}

export function generateMockChargePoints(): ChargePoint[] {
  return [
    generateMockChargePoint("cp-001", "Станция Центр", "ул. Ленина, 45"),
  ]
}

export function generateMockTransactions(chargePointId?: string): Transaction[] {
  const transactions: Transaction[] = []
  const now = Date.now()

  for (let i = 0; i < 20; i++) {
    const startTime = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000)
    const duration = Math.random() * 3 * 60 * 60 * 1000 // up to 3 hours
    const stopTime = new Date(startTime.getTime() + duration)
    const kWh = Math.random() * 40 + 5

    transactions.push({
      id: `txn-${i.toString().padStart(3, "0")}`,
      chargePointId: chargePointId || `cp-00${Math.floor(Math.random() * 4) + 1}`,
      connectorId: Math.floor(Math.random() * 4) + 1,
      idTag: `RFID-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      startTime: startTime.toISOString(),
      stopTime: i < 3 ? null : stopTime.toISOString(),
      meterStart_Wh: Math.floor(Math.random() * 10000),
      meterStop_Wh: i < 3 ? null : Math.floor(Math.random() * 10000 + 5000),
      kWh: i < 3 ? Math.random() * 10 : kWh,
      status: i < 3 ? "Active" : "Completed",
      userId: `user-${Math.floor(Math.random() * 100)}`,
      cost: i < 3 ? undefined : kWh * 0.35,
    })
  }

  return transactions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
}
