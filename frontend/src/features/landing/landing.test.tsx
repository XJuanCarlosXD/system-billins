import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Landing } from './index'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

describe('Landing', () => {
  it('renders login CTAs pointing to /sign-in', async () => {
    const screen = await render(<Landing />)
    const loginLinks = screen.getByRole('link', { name: /iniciar sesión/i })
    await expect
      .element(loginLinks.first())
      .toHaveAttribute('href', '/sign-in')
  })

  it('renders all 11 business modules', async () => {
    const screen = await render(<Landing />)
    for (const title of [
      'Facturacion',
      'Cuentas por Cobrar',
      'Cuentas por Pagar',
      'Ordenes de Compra',
      'Licitaciones',
      'Inventario',
      'Bancos / Cheques',
      'Caja Chica',
      'Nomina',
      'Activos Fijos',
      'Contabilidad',
    ]) {
      await expect.element(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('renders AI assistant skill examples', async () => {
    const screen = await render(<Landing />)
    await expect.element(screen.getByText('Facturar')).toBeInTheDocument()
    await expect
      .element(screen.getByText('Consultar cuenta cliente'))
      .toBeInTheDocument()
  })
})
