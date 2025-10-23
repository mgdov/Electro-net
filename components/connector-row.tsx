"use client"

import type { Connector } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Square, AlertCircle, Loader2 } from "lucide-react"
import { getConnectorStatusColor, getConnectorStatusLabel, formatPower, formatErrorCode } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"


interface ConnectorRowProps {
  connector: Connector
  chargePointId: string
  onStart: (connectorId: number) => Promise<any>
  onStop: (transactionId: string) => Promise<any>
}

export function ConnectorRow({ connector, chargePointId, onStart, onStop }: ConnectorRowProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const isOccupied = connector.status === "Occupied"
  const isFaulted = connector.status === "Faulted"
  const isAvailable = connector.status === "Available"
  const isAwaitingTx = isOccupied && !connector.currentTransactionId && connector.awaitingTransactionId

  console.log(`[ConnectorRow] ${connector.chargePointId} connector ${connector.connectorId}: status=${connector.status}, errorCode=${connector.errorCode}`)

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const response = await onStart(connector.connectorId)
      // Не показываем toast при успешном запуске, только при ошибке
      if (!response?.success) {
        toast({
          title: "Ошибка запуска",
          description: response?.error || response?.message || "Команда отклонена контроллером",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Start charging error:", error)
      const errorMessage = error instanceof Error ? error.message : "Не удалось отправить команду"
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    // Пробуем найти транзакцию через connector.currentTransactionId, если нет — ищем в глобальном состоянии
    let txId = connector.currentTransactionId
    if (!txId) {
      // Попробовать найти активную транзакцию по chargePointId и connectorId (если вдруг не обновился)
      toast({
        title: "Ошибка",
        description: "Нет активной транзакции. Попробуйте обновить страницу или дождаться события от станции.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await onStop(txId)
      if (response?.success) {
        toast({
          title: "Зарядка остановлена",
          description: `Транзакция ${txId} завершена`,
        })
      } else {
        toast({
          title: "Ошибка остановки",
          description: response?.error || response?.message || "Команда отклонена контроллером",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Stop charging error:", error)
      const errorMessage = error instanceof Error ? error.message : "Не удалось отправить команду"
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
      {/* Connector Number */}
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
        <span className="text-lg font-bold text-foreground">{connector.connectorId}</span>
      </div>

      {/* Status and Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={cn("font-medium", getConnectorStatusColor(connector.status))}>
            {getConnectorStatusLabel(connector.status)}
          </Badge>
          {isFaulted && connector.errorCode && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {formatErrorCode(connector.errorCode)}
            </div>
          )}
        </div>

        {/* Power and SOC */}
        {isOccupied && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Мощность:</span>
              <span className="font-semibold text-[var(--color-occupied)]">
                {formatPower(connector.currentPower_kW)}
              </span>
            </div>
            {connector.soc_percent !== null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">SOC:</span>
                <span className="font-semibold text-foreground">{connector.soc_percent}%</span>
              </div>
            )}
            {connector.currentTransactionId && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-xs text-foreground">{connector.currentTransactionId.slice(0, 12)}</span>
              </div>
            )}
          </div>
        )}

        {isAvailable && (
          <div className="text-sm text-muted-foreground">
            Готов к зарядке • {formatPower(connector.powerLimit_kW)} макс.
          </div>
        )}
      </div>

      {/* Power Bar for Occupied */}
      {isOccupied && (
        <div className="flex-1 max-w-[200px]">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-occupied)] transition-all duration-500"
              style={{ width: `${(connector.currentPower_kW / connector.powerLimit_kW) * 100}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {Math.round((connector.currentPower_kW / connector.powerLimit_kW) * 100)}%
          </div>
        </div>
      )}

      {/* Actions: single toggle button */}
      <div className="flex gap-2">
        {isFaulted ? (
          <Button size="sm" variant="outline" disabled>
            <AlertCircle className="h-4 w-4 mr-1" />Ошибка
          </Button>
        ) : isAwaitingTx ? (
          <Button size="sm" variant="secondary" disabled className="gap-2" aria-busy="true" aria-label="Ожидание идентификатора транзакции">
            <Loader2 className="h-4 w-4 animate-spin" /> Инициализация...
          </Button>
        ) : (
          <Button
            onClick={isOccupied ? handleStop : handleStart}
            size="sm"
            disabled={isLoading || (!isOccupied && !isAvailable)}
            aria-label={
              isLoading
                ? isOccupied
                  ? "Остановка зарядки"
                  : "Запуск зарядки"
                : isOccupied
                  ? "Остановить зарядку"
                  : "Запустить зарядку"
            }
            aria-busy={isLoading}
            className={cn(
              "transition-colors",
              isOccupied
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-[var(--color-success)] hover:bg-[var(--color-success)]/90",
            )}
          >
            {isOccupied ? (
              <Square className="h-4 w-4 mr-1" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 mr-1" aria-hidden="true" />
            )}
            {isLoading
              ? isOccupied
                ? "Остановка..."
                : "Запуск..."
              : isOccupied
                ? "Стоп"
                : "Старт"}
          </Button>
        )}
      </div>
    </div>
  )
}
