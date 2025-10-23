"use client"

import type { Transaction } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatDuration, formatEnergy } from "@/lib/utils"
import { Activity, Clock, Zap, DollarSign, Trash2, Loader2 } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface TransactionsTableProps {
  transactions: Transaction[]
  onDelete: (id: string) => Promise<{ success: boolean; error?: string } | any>
}

export function TransactionsTable({ transactions, onDelete }: TransactionsTableProps) {
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const handleDelete = async (id: string) => {
    if (deleting.has(id)) return
    const next = new Set(deleting); next.add(id); setDeleting(next)
    const result = await onDelete(id)
    const next2 = new Set(next); next2.delete(id); setDeleting(next2)
    toast({
      title: result.success ? 'Удалено' : 'Ошибка',
      description: result.success ? `Транзакция ${id} удалена` : (result.error || 'Не удалось удалить'),
      variant: result.success ? undefined : 'destructive'
    })
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <TransactionRow
          key={`${transaction.id}-${transaction.startTime ?? ""}`}
          transaction={transaction}
          onDelete={handleDelete}
          isDeleting={deleting.has(transaction.id)}
        />
      ))}
    </div>
  )
}

function TransactionRow({ transaction, onDelete, isDeleting }: { transaction: Transaction; onDelete: (id: string) => void; isDeleting: boolean }) {
  const isActive = transaction.status === "Active"
  const isCompleted = transaction.status === "Completed"
  const isFailed = transaction.status === "Failed"

  return (
    <Card className="group relative bg-card border-border p-4 hover:bg-secondary/30 transition-colors">
      {/* Delete button (hover reveal) */}
      <button
        onClick={() => onDelete(transaction.id)}
        disabled={isDeleting}
        aria-label={`Удалить транзакцию ${transaction.id}`}
        className="absolute top-2 right-2 h-5 w-5 inline-flex items-center justify-center rounded-md bg-destructive/80 hover:bg-destructive focus:outline-none focus:ring-2 focus:ring-destructive/50 text-destructive-foreground shadow-sm text-[10px] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Transaction ID and Status */}
        <div className="flex items-center gap-3 lg:w-[200px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Activity className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <div className="font-mono text-sm font-medium text-foreground">{transaction.id}</div>
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={
                isActive
                  ? "bg-[var(--color-occupied)] text-white"
                  : isCompleted
                    ? "bg-[var(--color-success)] text-white"
                    : "bg-[var(--color-error)] text-white"
              }
            >
              {transaction.status === "Active"
                ? "Активна"
                : transaction.status === "Completed"
                  ? "Завершена"
                  : "Ошибка"}
            </Badge>
          </div>
        </div>

        {/* Charge Point and Connector */}
        <div className="flex items-center gap-2 lg:w-[180px]">
          <div className="text-sm">
            <div className="text-muted-foreground">Станция</div>
            <div className="font-medium text-foreground">{transaction.chargePointId}</div>
            <div className="text-xs text-muted-foreground">Коннектор {transaction.connectorId}</div>
          </div>
        </div>

        {/* Time Info */}
        <div className="flex items-center gap-2 lg:flex-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <div className="text-muted-foreground">Начало</div>
            <div className="font-medium text-foreground">{formatDate(transaction.startTime)}</div>
            <div className="text-xs text-muted-foreground">
              Длительность: {formatDuration(transaction.startTime, transaction.stopTime)}
            </div>
          </div>
        </div>

        {/* Energy */}
        <div className="flex items-center gap-2 lg:w-[140px]">
          <Zap className="h-4 w-4 text-[var(--color-warning)]" />
          <div className="text-sm">
            <div className="text-muted-foreground">Энергия</div>
            <div className="font-semibold text-foreground">{formatEnergy(transaction.kWh)}</div>
          </div>
        </div>

        {/* Cost */}
        {transaction.cost !== undefined && (
          <div className="flex items-center gap-2 lg:w-[120px]">
            <DollarSign className="h-4 w-4 text-[var(--color-success)]" />
            <div className="text-sm">
              <div className="text-muted-foreground">Стоимость</div>
              <div className="font-semibold text-foreground">{transaction.cost.toFixed(2)} ₽</div>
            </div>
          </div>
        )}

        {/* User ID */}
        <div className="text-sm lg:w-[140px]">
          <div className="text-muted-foreground">ID карты</div>
          <div className="font-mono text-xs text-foreground">{transaction.idTag}</div>
        </div>
      </div>
    </Card>
  )
}
