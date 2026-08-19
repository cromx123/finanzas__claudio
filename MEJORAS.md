# Mejoras pendientes

Lista de cosas para mejorar o añadir, basada en revisión del código actual (no son ideas al aire — cada ítem indica dónde está el gap).

## Bugs / funcionalidad incompleta


- [x] ~~**Costo siempre a precio promedio**~~ — resuelto: contabilidad de lotes real. `Transaction.remaining_quantity` + nueva tabla `transaction_lot_allocations` (migración `0003_lot_allocations`) reemplazan el cálculo de costo promedio ciego en `run_ledger`. Motor en [modules/portfolios/lots.py](services/api/app/modules/portfolios/lots.py) (`allocate_fifo`/`allocate_lifo`/`allocate_specific`) — de paso corrige un bug real que encontró la revisión de código: `update_transaction` permitía reducir una compra por debajo de lo ya vendido, corrompiendo el ledger en silencio.
- [x] ~~**Selección de lote al vender**~~ — resuelto junto con el punto anterior. `AddTransactionModal.tsx` muestra selector FIFO/LIFO/Específico al vender (con tabla de lotes abiertos y validación de que la suma coincida con la cantidad a vender) cuando el activo tiene más de un lote. Endpoint nuevo: `GET /v1/portfolios/{id}/lots?yahoo_symbol=X`.
- **Sin importación de transacciones** — existe exportación a CSV de movimientos ([lib/export/movements.ts](apps/web/lib/export/movements.ts)) pero no el camino inverso (cargar transacciones masivas desde un CSV/broker).
- **Objetivos (módulo Goals)** — no lo revisé a fondo esta sesión; vale la pena una pasada para ver si tiene los mismos gaps que Panel/Perfil tenían antes de esta ronda de cambios.
- [x] ~~**`DELETE /v1/portfolios/{id}` fallaba con 500 si tenía transacciones**~~ — bug encontrado al probar la selección de lote en un portafolio de prueba, no reportado antes. La relación `Portfolio.transactions` no tenía `passive_deletes=True`, así que el ORM intentaba poner `portfolio_id = NULL` en cada transacción antes de borrar el portafolio — y esa columna es `NOT NULL`. Ahora delega en el `ON DELETE CASCADE` real de la base de datos ([models/portfolio.py](services/api/app/models/portfolio.py)).

## Funcionalidades nuevas sugeridas

- [x] ~~**Historial real de tipo de cambio para Perfil**~~ — resuelto: `FxRate` ahora se backfillea como serie histórica real (`fx_service.ingest_fx_history`) y se consulta "al día exacto" (`get_rate_on_date`/`get_rates_on_dates`, mismo patrón bisect que ya usaba el gráfico de performance). Nuevo endpoint `GET /v1/networth/history` + gráfico "Patrimonio en el tiempo" en la pestaña Resumen de Perfil — no existía ninguna vista de patrimonio combinado en el tiempo antes de esto.

- [x] ~~**Mejorar alertas en Mi perfil**~~ — resuelto en dos partes. UX: autocompletado case-insensitive compartido (`TickerAutocomplete`, extraído para no triplicarlo entre AddTransactionModal/AddAssetForm/AlertsPanel) y `MoneyInput` con máscara es-CL (`.` miles, `,` decimales, placeholder `0,00`). Condiciones: motor de indicadores extensible ([modules/alerts/indicators.py](services/api/app/modules/alerts/indicators.py)) — RSI y Bandas de Bollinger además del precio fijo, agregar uno nuevo es una clase + una entrada en el registry, no una migración de enum.

## Infraestructura / deuda técnica

- **Redis está en el stack pero no se usa** — declarado en [services/api/app/core/config.py](services/api/app/core/config.py) y en `docker-compose.yml`, pero no hay ninguna llamada real a caché/cola en el código. O se usa (cachear `/v1/screener`, el fetch de `^GSPC` del gráfico de evolución, etc. — varios endpoints hacen llamadas en vivo a Yahoo que podrían cachearse) o se saca del stack.
- **Sin caché en endpoints que pegan a Yahoo en vivo** — `POST /v1/screener` (agregar ticker), `GET /v1/assets/{symbol}/price-on-date` (fallback), y el benchmark de `GET /v1/portfolios/{id}/performance` no cachean nada más allá del `staleTime` de React Query en el frontend. Ver conversación sobre "cargar más rápido" — la recomendación de pre-ingestar tickers ya se aplicó parcialmente (`add_transaction` ahora hace ingesta completa la primera vez), pero un caché de verdad (Redis) sería el siguiente paso.
- **Flujo de build de `apps/web` en Docker** — durante esta sesión hubo confusión real sobre si el contenedor `web` reflejaba el código más reciente (no bastaba con `docker compose build` sin forzar). Vale la pena revisar el Dockerfile/cache de `apps/web` para que un rebuild normal siempre recoja los cambios sin necesitar `--no-cache`.
