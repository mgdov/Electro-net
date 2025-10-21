import type { ChargePoint, Connector, ConnectorStatus, Transaction } from "./types"
import type { ApiStation, ApiConnector, ApiTransaction } from "./api-client"

// Map API connector status to our internal status
function mapConnectorStatus(apiStatus: string): ConnectorStatus {
    switch (apiStatus) {
        case "Charging":
            return "Occupied"
        case "Available":
            return "Available"
        case "Faulted":
            return "Faulted"
        case "Unavailable":
            return "Unavailable"
        default:
            return "Available"
    }
}

// Map API connector to our Connector type
export function mapApiConnector(apiConnector: ApiConnector, stationId: string): Connector {
    const status = mapConnectorStatus(apiConnector.status)

    return {
        id: apiConnector.id,
        connectorId: apiConnector.id,
        chargePointId: stationId,
        status,
        currentTransactionId: apiConnector.transactionId,
        powerLimit_kW: 50, // Default, API doesn't provide this
        currentPower_kW: apiConnector.power_kW,
        voltage_V: status === "Occupied" ? 400 : 0, // Estimated
        current_A: status === "Occupied" ? 60 : 0, // Estimated
        soc_percent: apiConnector.soc,
        errorCode: status === "Faulted" ? "UnknownError" : null,
        lastUpdated: apiConnector.updatedAt,
    }
}

// Map API station to our ChargePoint type
export function mapApiStation(apiStation: ApiStation): ChargePoint {
    return {
        id: apiStation.id,
        name: apiStation.name,
        location: "Удалённая станция", // API doesn't provide location
        firmwareVersion: "N/A", // API doesn't provide version
        status: apiStation.status === "Available" ? "online" : "online",
        lastSeen: new Date().toISOString(),
        model: "OCPP Station",
        vendor: "Unknown",
        connectors: apiStation.connectors.map((conn) => mapApiConnector(conn, apiStation.id)),
    }
}

export function mapApiTransaction(t: ApiTransaction): Transaction {
    return {
        id: t.id,
        chargePointId: t.chargePointId,
        connectorId: t.connectorId,
        idTag: t.idTag || "UNKNOWN",
        startTime: t.startTime,
        stopTime: t.stopTime,
        meterStart_Wh: t.meterStart,
        meterStop_Wh: t.meterStop,
        kWh: t.totalKWh !== null ? t.totalKWh : (t.meterStop !== null ? (t.meterStop - t.meterStart) / 1000 : 0),
        status: t.stopTime ? "Completed" : "Active",
        cost: t.cost ?? undefined,
        userId: undefined,
    }
}

export function mapApiTransactions(list: ApiTransaction[]): Transaction[] {
    return list.map(mapApiTransaction)
}

// Map array of API stations
export function mapApiStations(apiStations: ApiStation[]): ChargePoint[] {
    return apiStations.map(mapApiStation)
}
