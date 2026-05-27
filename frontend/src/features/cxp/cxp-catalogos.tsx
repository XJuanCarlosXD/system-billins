// CxP Config catalog screens: cias, puntos, tproveedores, tdocu, ciudades, barrios
import { CatalogoCrud } from '../cxc/cxc-catalogo-base'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string }

const _noSave = async () => { throw new Error('Solo lectura en esta pantalla') }

// ─── FCXP101 Compañías ────────────────────────────────────────────────────────
export function CxpCias({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP101 — Compañías CxP"
    idFields={['no_cia']}
    noCia={noCia}
    fields={[
      { key: 'no_cia', label: 'No Cia', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'activa', label: 'Activa', width: '70px' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListCias()}
    saveFn={_noSave}
  />
}

// ─── FCXP102 Sucursales ───────────────────────────────────────────────────────
export function CxpPuntos({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP102 — Sucursales CxP"
    idFields={['no_cia', 'punto']}
    noCia={noCia}
    fields={[
      { key: 'no_cia', label: 'No Cia', width: '80px' },
      { key: 'punto', label: 'Punto', width: '70px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'mes_proceso', label: 'Mes Proc.', type: 'number', width: '90px' },
      { key: 'ano_proceso', label: 'Año Proc.', type: 'number', width: '90px' },
      { key: 'activo', label: 'Activo', width: '70px' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListPuntos(noCia)}
    saveFn={_noSave}
  />
}

// ─── FCXP103 Tipos de Proveedor ───────────────────────────────────────────────
export function CxpTproveedores({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP103 — Tipos de Proveedor"
    idFields={['codigo']}
    noCia={noCia}
    fields={[
      { key: 'codigo', label: 'Código', width: '90px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'clase_proveedor', label: 'Clase', width: '80px' },
      { key: 'cuenta', label: 'Cuenta Contable', width: '130px' },
      { key: 'cuenta_prima', label: 'Cuenta Prima', width: '120px' },
      { key: 'centro_costo', label: 'Centro Costo', width: '110px' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListTproveedores()}
    saveFn={_noSave}
  />
}

// ─── FCXP104 Tipos de Documento ───────────────────────────────────────────────
export function CxpTdocu({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP104 — Tipos de Documento CxP"
    idFields={['tipo_docu']}
    noCia={noCia}
    fields={[
      { key: 'tipo_docu', label: 'Tipo Doc', width: '90px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'tipo_movi', label: 'Mov.', width: '60px' },
      { key: 'tipo_transaccion', label: 'Transacción', width: '110px' },
      { key: 'cuenta', label: 'Cuenta', width: '120px' },
      { key: 'centro_costo', label: 'Centro Costo', width: '110px' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListTdocuConfig()}
    saveFn={_noSave}
  />
}

// ─── FCXP111 Ciudades ─────────────────────────────────────────────────────────
export function CxpCiudades({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP111 — Ciudades"
    idFields={['ciudad']}
    noCia={noCia}
    fields={[
      { key: 'ciudad', label: 'Código', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListCiudades()}
    saveFn={_noSave}
  />
}

// ─── FCXP112 Barrios ──────────────────────────────────────────────────────────
export function CxpBarrios({ noCia }: P) {
  return <CatalogoCrud
    title="FCXP112 — Sectores / Barrios"
    idFields={['ciudad', 'barrio']}
    noCia={noCia}
    fields={[
      { key: 'ciudad', label: 'Ciudad', width: '80px' },
      { key: 'barrio', label: 'Barrio', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
    ]}
    fetchFn={() => regalGeneralApi.cxpListBarrios()}
    saveFn={_noSave}
  />
}
