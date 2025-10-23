"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { TransactionsTable } from "@/components/transactions-table"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { TransactionsFilters } from "@/components/transactions-filters"
import { useChargePoints } from "@/hooks/use-charge-points"

export default function TransactionsPage() {
  const { transactions, clearTransactions, deleteTransaction } = useChargePoints()
  const [isClearing, setIsClearing] = useState(false)
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">История транзакций</h1>
              <p className="text-muted-foreground">Журнал всех зарядных сессий (данные с API)</p>
            </div>
            <button
              onClick={async () => {
                if (transactions.length === 0 || isClearing) return
                setIsClearing(true)
                const ok = await clearTransactions()
                setIsClearing(false)
                toast({
                  title: ok ? "Список очищен" : "Ошибка",
                  description: ok ? "Все транзакции удалены" : "Endpoint недоступен или не реализован (404)",
                  variant: ok ? undefined : "destructive"
                })
              }}
              disabled={isClearing || transactions.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium bg-secondary hover:bg-secondary/80 disabled:opacity-50"
              aria-busy={isClearing}
            >
              {isClearing ? (
                <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> Очищение...</span>
              ) : (
                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Очистить</span>
              )}
            </button>
          </div>
        </div>

        <TransactionsFilters />
        {transactions.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нет транзакций</div>
        ) : (
          <TransactionsTable transactions={transactions} onDelete={deleteTransaction} />
        )}
      </main>
    </div>
  )
}
