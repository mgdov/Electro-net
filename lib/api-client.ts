// API client for charge points backend
const API_BASE_URL = "http://176.88.248.139:8081/api"

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
    transactionId: number | string  // Изменено с id на transactionId
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

            console.log("[API Client] getStations result.data:", JSON.stringify(result.data, null, 2))

            return result.data
        } catch (error) {
            console.error("Failed to fetch stations:", error)
            throw error
        }
    }

    async getTransactions(): Promise<ApiTransaction[]> {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/recent?limit=10`, {
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
            console.log("[API Client] Sending remote-start-session:", JSON.stringify(payload, null, 2))
            const response = await fetch(`${this.baseUrl}/admin/remote-start-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            const result = await this.parseCommandResponse(response, "remote-start-session")
            console.log("[API Client] remote-start-session result:", JSON.stringify(result, null, 2))
            return result
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

            console.log("[API Client] Sending remote-stop-session:", JSON.stringify(normalizedPayload, null, 2))
            const response = await fetch(`${this.baseUrl}/admin/remote-stop-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(normalizedPayload),
            })

            const result = await this.parseCommandResponse(response, "remote-stop-session")
            console.log("[API Client] remote-stop-session result:", JSON.stringify(result, null, 2))
            return result
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

    async deleteRecentTransactions(): Promise<boolean> {
        const attempts: Array<{ url: string; method: string }> = [
            { url: `${this.baseUrl}/transactions/recent/delete`, method: 'POST' }, // original guess
            { url: `${this.baseUrl}/transactions/recent`, method: 'DELETE' },      // REST style
            { url: `${this.baseUrl}/transactions/delete`, method: 'POST' },        // alternate
        ]
        for (const attempt of attempts) {
            try {
                console.log(`[API Client] Trying clear endpoint: ${attempt.method} ${attempt.url}`)
                const response = await fetch(attempt.url, {
                    method: attempt.method,
                    headers: { 'Content-Type': 'application/json' }
                })
                if (response.status === 404) {
                    // Try next pattern
                    const bodyTxt = await response.text()
                    console.warn(`[API Client] Clear endpoint 404 (${attempt.method} ${attempt.url}) -> ${bodyTxt.slice(0, 120)}`)
                    continue
                }
                if (!response.ok) {
                    const text = await response.text()
                    console.error(`[API Client] Failed clear attempt (${attempt.method} ${attempt.url}): HTTP ${response.status} -> ${text}`)
                    continue
                }
                const contentType = response.headers.get('content-type')
                if (contentType?.includes('application/json')) {
                    const body = await response.json().catch(() => null)
                    if (body && body.success === false) {
                        console.error('[API Client] Clear transactions rejected:', body.error)
                        continue
                    }
                }
                console.log('[API Client] ✅ Transactions cleared')
                return true
            } catch (e) {
                console.error(`[API Client] Clear attempt error (${attempt.method} ${attempt.url}):`, e)
                continue
            }
        }
        console.error('[API Client] All clear attempts failed; endpoint likely not implemented')
        return false
    }

    async deleteTransaction(transactionId: string | number): Promise<ApiCommandResponse> {
        const id = typeof transactionId === 'number' ? transactionId : String(transactionId)
        const url = `${this.baseUrl}/transactions/recent/${id}`
        try {
            console.log('[API Client] Deleting transaction', id)
            const response = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
            const contentType = response.headers.get('content-type') || ''
            let body: any = null
            if (contentType.includes('application/json')) {
                body = await response.json().catch(() => null)
            } else {
                body = await response.text().catch(() => '')
            }
            if (!response.ok) {
                const errorMsg = typeof body === 'string' ? body : body?.error || body?.message || `HTTP ${response.status}`
                console.error('[API Client] deleteTransaction failed:', errorMsg)
                return { success: false, error: errorMsg, message: body?.message, data: null }
            }
            if (typeof body === 'object' && body !== null) {
                return {
                    success: body.success ?? true,
                    message: body.message,
                    error: body.error,
                    data: body.data ?? null,
                }
            }
            return { success: true }
        } catch (e) {
            console.error('[API Client] deleteTransaction error:', e)
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
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
