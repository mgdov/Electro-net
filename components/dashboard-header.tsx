import Link from "next/link"
import { Activity, Zap } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">EV Charging</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Activity className="h-4 w-4" />
              Дашборд
            </Link>
            <Link
              href="/transactions"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Транзакции
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Настройки
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
