// API client for charge points backend
const API_BASE_URL = "http://192.168.88.54:8081/api"

export interface ApiConnector {
    id: number
    type: string
    status: "Available" | "Charging" | "Faulted" | "Unavailable"
    power_kW: number
    soc: number | null
    transactionId: string | null
    price: number
    updatedAt: string
}

export interface ApiStation {
    id: string
    name: string
    status: "Available" | "Charging" | "Faulted" | "Unavailable"
    connectors: ApiConnector[]
}

export interface ApiResponse<T> {
    success: boolean
    data: T
    error?: string
}

// Raw transaction shape from backend
export interface ApiTransaction {
    id: string
    chargePointId: string
    connectorId: number
    startTime: string
    stopTime: string | null
    meterStart: number
    meterStop: number | null
    energy: number | null
    totalKWh: number | null
    cost: number | null
    efficiencyPercentage: number | null
    idTag: string | null
    reason: string | null
    transactionData: any[] | null
}

export interface ApiTransactionPayload {
    id: string
    chargePointId: string
    connectorId: number
    startTime: string
    stopTime: string | null
    meterStart: number
    meterStop: number | null
    totalKWh: number | null
    cost: number | null
    idTag: string | null
    energy?: number | null
    efficiencyPercentage?: number | null
    reason?: string | null
    transactionData?: any[] | null
}

export interface ApiCommandResponse {
    success: boolean
    message?: string
    error?: string
    data?: Record<string, any> | null
}

export interface RemoteStartSessionPayload {
    chargePointId: string
    connectorId: number
    idTag: string
}

export interface RemoteStopSessionPayload {
    chargePointId: string
    connectorId: number
    transactionId: number | string
}

export class ApiClient {
    private baseUrl: string

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl
    }

    async getStations(): Promise<ApiStation[]> {
        try {
            const response = await fetch(`${this.baseUrl}/stations`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store", // Disable caching for real-time data
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // Check if response is actually JSON
            const contentType = response.headers.get("content-type")
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text()
                console.error("Non-JSON response:", text.substring(0, 200))
                throw new Error(`Expected JSON but got: ${contentType || "unknown"}`)
            }

            const result: ApiResponse<ApiStation[]> = await response.json()

            if (!result.success) {
                throw new Error(result.error || "API request failed")
            }

            return result.data
        } catch (error) {
            console.error("Failed to fetch stations:", error)
            throw error
        }
    }

    async getTransactions(): Promise<ApiTransaction[]> {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/recent`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const contentType = response.headers.get("content-type")
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text()
                console.error("Non-JSON response (transactions):", text.substring(0, 200))
                throw new Error(`Expected JSON but got: ${contentType || "unknown"}`)
            }

            const result: ApiResponse<ApiTransaction[]> & { count?: number } = await response.json()
            if (!result.success) {
                throw new Error(result.error || "API request failed")
            }
            return result.data
        } catch (error) {
            console.error("Failed to fetch transactions:", error)
            throw error
        }
    }

    async remoteStartSession(payload: RemoteStartSessionPayload): Promise<ApiCommandResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/admin/remote-start-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            return await this.parseCommandResponse(response, "remote-start-session")
        } catch (error) {
            console.error("[API Client] Failed to queue remote start:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }
        }
    }

    async remoteStopSession(payload: RemoteStopSessionPayload): Promise<ApiCommandResponse> {
        try {
            const normalizedPayload: RemoteStopSessionPayload = {
                ...payload,
                transactionId:
                    typeof payload.transactionId === "string" && /^\d+$/.test(payload.transactionId)
                        ? Number.parseInt(payload.transactionId, 10)
                        : payload.transactionId,
            }

            const response = await fetch(`${this.baseUrl}/admin/remote-stop-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(normalizedPayload),
            })

            return await this.parseCommandResponse(response, "remote-stop-session")
        } catch (error) {
            console.error("[API Client] Failed to queue remote stop:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }
        }
    }

    async postTransaction(payload: ApiTransactionPayload): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/recent`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`Failed to post transaction: HTTP ${response.status} -> ${errorText}`)
                return false
            }

            const contentType = response.headers.get("content-type")
            if (contentType?.includes("application/json")) {
                const result = await response.json()
                if (result.success === false) {
                    console.error("Transaction post rejected:", result.error)
                    return false
                }
            }

            return true
        } catch (error) {
            console.error("Failed to post transaction:", error)
            return false
        }
    }

    private async parseCommandResponse(response: Response, action: string): Promise<ApiCommandResponse> {
        const contentType = response.headers.get("content-type") ?? ""
        let body: any = null

        try {
            if (contentType.includes("application/json")) {
                body = await response.json()
            } else {
                body = await response.text()
            }
        } catch (parseError) {
            console.error(`[API Client] Failed to parse ${action} response:`, parseError)
        }

        if (!response.ok) {
            const fallback = typeof body === "string" ? body : body?.error || body?.message
            console.error(
                `[API Client] ${action} failed: HTTP ${response.status} -> ${fallback ?? "Unknown error"}`,
            )
            return {
                success: false,
                message: typeof body === "object" && body !== null ? body.message : undefined,
                error: fallback ?? `HTTP ${response.status}`,
                data: typeof body === "object" && body !== null ? body.data ?? null : null,
            }
        }

        if (typeof body === "object" && body !== null) {
            return {
                success: body.success ?? true,
                message: typeof body.message === "string" ? body.message : undefined,
                error: typeof body.error === "string" ? body.error : undefined,
                data: body.data ?? null,
            }
        }

        return {
            success: true,
            message: typeof body === "string" && body.length > 0 ? body : undefined,
            data: null,
        }
    }
}

export const apiClient = new ApiClient()
