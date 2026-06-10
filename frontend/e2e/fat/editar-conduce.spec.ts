/**
 * F4 — Editar conduce (Gap G2 2026-05-30)
 *
 * Pre-requisitos:
 *   - Backend Django corriendo en http://localhost:8000
 *   - Frontend Vite corriendo en http://localhost:5173
 *   - Usuario JCABREU / Temp1234! con permisos FAT no_cia=01 punto=01
 *   - Conduce CT-00003924 existente, no autorizado, no anulado, sin factura.
 *
 * Flujo cubierto:
 *   1. Login form
 *   2. Navegar a /fat/conduces (lista)
 *   3. Abrir detalle de CT-00003924 → drawer → botón "Editar"
 *   4. Redirige a /fat/nuevo-conduce?id=00003924&tipo=CT (modo edición)
 *   5. Modificar cantidad de la primera línea
 *   6. Click "Guardar"
 *   7. Verificar HTTP 200 en PATCH /api/fat/conduces/CT/00003924/
 *   8. Verificar ausencia de console.error
 *   9. Screenshot final en backend/docs/captures/fat/f4-conduce-edit.png
 *
 * NOTA: este archivo asume que existe `playwright.config.ts` con baseURL
 * http://localhost:5173 y projects: [{ name: 'chromium' }]. Si no existe,
 * crear uno mínimo (ver instrucciones al final del reporte del implementer).
 */

import { test, expect, type Request, type Response, type ConsoleMessage } from '@playwright/test'

const FRONTEND_URL = process.env.SIGAFT_FRONT_URL ?? 'http://localhost:5173'
const BACKEND_URL = process.env.SIGAFT_BACK_URL ?? 'http://localhost:8000'
const USERNAME = process.env.SIGAFT_USER ?? 'JCABREU'
const PASSWORD = process.env.SIGAFT_PASS ?? 'Temp1234!'
const NO_CIA = process.env.SIGAFT_NO_CIA ?? '01'
const PUNTO = process.env.SIGAFT_PUNTO ?? '01'
const CONDUCE_TIPO = process.env.SIGAFT_CONDUCE_TIPO ?? 'CT'
const CONDUCE_NO = process.env.SIGAFT_CONDUCE_NO ?? '00003924'

test('F4: editar conduce existente vía PATCH (Gap G2)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // 1. Login
  await page.goto(`${FRONTEND_URL}/sign-in`)
  await page.getByLabel(/usuario|username/i).fill(USERNAME)
  await page.getByLabel(/contraseña|password/i).fill(PASSWORD)
  await page.getByRole('button', { name: /entrar|sign in|login/i }).click()
  await page.waitForURL(/\/(dashboard|fat|home)/, { timeout: 15_000 })

  // 2. Ir a la lista de conduces (asumiendo año/mes vigentes del conduce)
  // El conduce CT-3924 es de 2026-04. La lista filtra por ano/mes.
  await page.goto(`${FRONTEND_URL}/fat/conduces?no_cia=${NO_CIA}&punto=${PUNTO}&ano=2026&mes=4`)
  await page.waitForLoadState('networkidle')

  // 3. Abrir detalle haciendo click en la fila del conduce target
  await page.getByText(CONDUCE_NO, { exact: false }).first().click()
  // Drawer / Sheet con título "Conduce CT-00003924"
  await expect(page.getByText(new RegExp(`${CONDUCE_TIPO}.${CONDUCE_NO}`))).toBeVisible({ timeout: 5_000 })

  // 4. Click en "Editar" — debe navegar a /fat/nuevo-conduce con search params
  await page.getByRole('button', { name: /editar/i }).click()
  await page.waitForURL(/\/fat\/nuevo-conduce/, { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  // 5. Esperar a que se cargue el form en modo edición
  await expect(page.getByText(/Editar Conduce/i)).toBeVisible({ timeout: 10_000 })

  // 6. Modificar cantidad de la primera línea (incrementar +1)
  const cantInput = page.getByRole('spinbutton').filter({ hasNotText: /precio|descuento|empaque/i }).first()
  const currentVal = await cantInput.inputValue()
  const newVal = String((parseFloat(currentVal) || 0) + 1)
  await cantInput.fill(newVal)

  // 7. Interceptar la respuesta PATCH antes de hacer click en Guardar
  const patchPromise: Promise<Response> = page.waitForResponse((resp: Response) =>
    resp.url().includes(`/api/fat/conduces/${CONDUCE_TIPO}/${CONDUCE_NO}/`) &&
    resp.request().method() === 'PATCH'
  , { timeout: 15_000 })

  await page.getByRole('button', { name: /guardar|crear/i }).click()
  const patchResp = await patchPromise

  // 8. Aserciones
  expect(patchResp.status(), `PATCH status: ${patchResp.status()}`).toBe(200)
  const body = await patchResp.json()
  expect(body.no_conduce).toBe(CONDUCE_NO)
  expect(body.tipo_conduce).toBe(CONDUCE_TIPO)
  expect(body.lineas?.[0]?.cantidad).toBe(parseFloat(newVal))

  // 9. Screenshot final
  await page.screenshot({
    path: 'backend/docs/captures/fat/f4-conduce-edit.png',
    fullPage: true,
  })

  // 10. Validar cero console.error
  expect(consoleErrors, `console.errors: ${consoleErrors.join('\n')}`).toHaveLength(0)
})

test('F4b: editar conduce autorizado debe devolver 422 (regla G2)', async ({ request }) => {
  // Smoke directo al backend para asegurar la regla de editabilidad.
  // Login para obtener cookie/csrf.
  const ctx = request
  const login = await ctx.post(`${BACKEND_URL}/api/auth/login/`, {
    data: { username: USERNAME, password: PASSWORD },
  })
  expect(login.status()).toBe(200)

  // Conduce CT-00003923 está AUTORIZADO=S en la data legacy.
  const patch = await ctx.patch(`${BACKEND_URL}/api/fat/conduces/CT/00003923/`, {
    data: {
      no_cia: NO_CIA, punto: PUNTO, no_cliente: 142, fecha: '2026-04-17',
      vendedor: '0001', clase: 'C',
      lineas: [{ no_linea: 1, almacen: '01', no_produ: '00003074', descripcion: 'X',
        cantidad: 1, precio: 100, porc_descuento: 0, porciento_impuesto: 18 }],
    },
  })
  expect(patch.status()).toBe(422)
  const body = await patch.json()
  expect(body.detail).toMatch(/autorizado|editable/i)
})
