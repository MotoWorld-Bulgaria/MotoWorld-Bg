"use client"

import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface PaymentStatusNotificationProps {
  status: string
  onRefresh?: () => void
  refreshing?: boolean
}

export default function PaymentStatusNotification({
  status,
  onRefresh,
  refreshing = false,
}: PaymentStatusNotificationProps) {
  if (status === "completed") {
    return (
      <Alert className="mb-4 bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Плащането е успешно</AlertTitle>
        <AlertDescription className="text-green-700">
          Вашето плащане беше успешно обработено. Поръчката ви е в процес на обработка.
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "failed") {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Проблем с плащането</AlertTitle>
        <AlertDescription>
          Възникна проблем при обработката на вашето плащане. Моля, опитайте отново или се свържете с нас за съдействие.
        </AlertDescription>
        {onRefresh && (
          <div className="mt-2">
            <Button variant="destructive" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Обновяване...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Опитай отново
                </>
              )}
            </Button>
          </div>
        )}
      </Alert>
    )
  }

  return (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Обработка на плащането</AlertTitle>
      <AlertDescription>Вашето плащане все още се обработва. Това може да отнеме няколко минути.</AlertDescription>
      {onRefresh && (
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Обновяване...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Обнови статуса
              </>
            )}
          </Button>
        </div>
      )}
    </Alert>
  )
}
