// OCPP and Charging Station Types

export type ConnectorStatus = "Available" | "Occupied" | "Faulted" | "Unavailable" | "Reserved"

export type TransactionStatus = "Active" | "Completed" | "Failed"

export type CommandStatus = "Pending" | "Sent" | "Accepted" | "Rejected" | "Failed"

export interface Connector {
  id: number
  connectorId: number // 1-4
  chargePointId: string
  status: ConnectorStatus
  currentTransactionId: string | null
  // True когда сессия запущена, но ещё не получен окончательный transactionId от станции
  awaitingTransactionId?: boolean
  powerLimit_kW: number
  currentPower_kW: number
  voltage_V: number
  current_A: number
  soc_percent: number | null // State of Charge
  errorCode: string | null
  lastUpdated: string
}

export interface Transaction {
  id: string
  chargePointId: string
  connectorId: number
  idTag: string
  startTime: string
  stopTime: string | null
  meterStart_Wh: number
  meterStop_Wh: number | null
  kWh: number
  status: TransactionStatus
  userId?: string
  cost?: number
}

export interface ChargePoint {
  id: string
  name: string
  location: string
  firmwareVersion: string
  status: "online" | "offline"
  lastSeen: string
  connectors: Connector[]
  model?: string
  vendor?: string
}

export interface OcppMessage {
  id: string
  chargePointId: string
  direction: "incoming" | "outgoing"
  action: string
  payload: Record<string, any>
  timestamp: string
  response?: Record<string, any>
}

// OCPP StatusNotification payload
export interface StatusNotificationPayload {
  connectorId: number
  status: ConnectorStatus
  errorCode: string
  info?: string
  timestamp: string
  vendorId?: string
  vendorErrorCode?: string
}

// OCPP RemoteStartTransaction payload
export interface RemoteStartTransactionPayload {
  connectorId?: number
  idTag: string
  chargingProfile?: any
}

// OCPP RemoteStopTransaction payload
export interface RemoteStopTransactionPayload {
  transactionId: string
}

// OCPP Command Response
export interface OcppCommandResponse {
  status: "Accepted" | "Rejected"
  transactionId?: string
  errorMessage?: string
}

export interface Command {
  id: string
  chargePointId: string
  connectorId: number | null
  commandType: "RemoteStartTransaction" | "RemoteStopTransaction" | "ChangeAvailability" | "Reset"
  params: Record<string, any>
  status: CommandStatus
  createdAt: string
  updatedAt: string
  result?: OcppCommandResponse
  errorMessage?: string
}

export interface MeterValue {
  timestamp: string
  power_kW: number
  energy_kWh: number
  voltage_V: number
  current_A: number
  soc_percent?: number
}

export interface WebSocketEvent {
  event:
  | "chargePoint.updated"
  | "connector.statusChanged"
  | "transaction.updated"
  | "command.result"
  | "meter.values"
  | "transaction.started"
  | "transaction.stopped"
  data: any
  timestamp: string
}
