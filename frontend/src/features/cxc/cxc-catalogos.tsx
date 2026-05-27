// Simple catalog screens: cias, puntos, tdocu, tcli, supervisores, rutas, tcontable, ciudades, barrios, zonas, cadenas
import { CatalogoCrud } from './cxc-catalogo-base'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string; mes?: number; ano?: number }

// ─── FCXC101 Compañías ────────────────────────────────────────────────────────
export function CxcCias({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC101 — Mantenimiento de Compañías"
    idFields={['no_cia']}
    noCia={noCia}
    fields={[
      { key: 'no_cia', label: 'No Cia', width: '80px' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'rnc', label: 'RNC', width: '120px' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'telefono', label: 'Teléfono', width: '120px' },
      { key: 'email', label: 'Email' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListCias()}
    saveFn={data => regalGeneralApi.cxcSaveCia(data)}
  />
}

// ─── FCXC102 Sucursales ───────────────────────────────────────────────────────
export function CxcPuntos({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC102 — Control de Sucursales"
    idFields={['no_cia', 'punto']}
    noCia={noCia}
    fields={[
      { key: 'no_cia', label: 'No Cia', width: '80px' },
      { key: 'punto', label: 'Punto', width: '80px' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'telefono', label: 'Teléfono', width: '120px' },
      { key: 'proximo_cli', label: 'Próx. Cliente', type: 'number', width: '110px' },
      { key: 'mes_proceso', label: 'Mes Proceso', type: 'number', width: '100px' },
      { key: 'ano_proceso', label: 'Año Proceso', type: 'number', width: '100px' },
      { key: 'saldos_menores', label: 'Saldos Menores', type: 'number' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListPuntos(noCia)}
    saveFn={data => regalGeneralApi.cxcSavePunto({ ...data, no_cia: noCia })}
  />
}

// ─── FCXC104 Tipo Documento ───────────────────────────────────────────────────
export function CxcTdocu({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC104 — Mantenimiento Tipo de Documento"
    idFields={['no_cia', 'tipo_doc']}
    noCia={noCia}
    fields={[
      { key: 'tipo_doc', label: 'Tipo Doc', width: '90px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'tipo_movimiento', label: 'Mov.', type: 'select', width: '80px', options: [{ value: 'DR', label: 'DR' }, { value: 'CR', label: 'CR' }] },
      { key: 'tipo_ncf', label: 'Tipo NCF', width: '90px' },
      { key: 'ncf_desde', label: 'NCF Desde', width: '100px' },
      { key: 'ncf_hasta', label: 'NCF Hasta', width: '100px' },
      { key: 'ncf_actual', label: 'NCF Actual', width: '100px' },
      { key: 'cuenta', label: 'Cuenta Contable', width: '130px' },
      { key: 'centro_costo', label: 'Centro Costo', width: '120px' },
      { key: 'controlar_entrega', label: 'Ctrl Entrega', type: 'checkbox', width: '110px' },
      { key: 'activo', label: 'Activo', type: 'checkbox', width: '80px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListTdocu(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveTdocu({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteTdocu(noCia, item.tipo_doc)}
  />
}

// ─── FCXC105 Tipo de Clientes ─────────────────────────────────────────────────
export function CxcTcli({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC105 — Mantenimiento Tipo de Clientes"
    idFields={['no_cia', 'tipo_cli']}
    noCia={noCia}
    fields={[
      { key: 'tipo_cli', label: 'Tipo', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'dias_credito', label: 'Días Crédito', type: 'number', width: '110px' },
      { key: 'limite_credito', label: 'Límite Crédito', type: 'number', width: '120px' },
      { key: 'activo', label: 'Activo', type: 'checkbox', width: '80px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListTcli(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveTcli({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteTcli(noCia, item.tipo_cli)}
  />
}

// ─── FCXC106 Supervisores ─────────────────────────────────────────────────────
export function CxcSupervisores({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC106 — Mantenimiento de Supervisores"
    idFields={['no_cia', 'supervisor']}
    noCia={noCia}
    fields={[
      { key: 'supervisor', label: 'Código', width: '80px' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'activo', label: 'Activo', type: 'checkbox', width: '80px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListSupervisores(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveSupervisor({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteSupervisor(noCia, item.supervisor)}
  />
}

// ─── FCXC108 Grupo de Ruta ────────────────────────────────────────────────────
export function CxcRutas({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC108 — Mantenimiento Grupo de Ruta"
    idFields={['no_cia', 'ruta']}
    noCia={noCia}
    fields={[
      { key: 'ruta', label: 'Ruta', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'zona', label: 'Zona', width: '80px' },
      { key: 'activo', label: 'Activo', type: 'checkbox', width: '80px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListRutas(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveRuta({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteRuta(noCia, item.ruta)}
  />
}

// ─── FCXC110 Tipo Contable ────────────────────────────────────────────────────
export function CxcTcontable({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC110 — Tipo Contable de Cliente"
    idFields={['no_cia', 'tipo_conta']}
    noCia={noCia}
    fields={[
      { key: 'tipo_conta', label: 'Tipo', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'cta_cliente', label: 'Cuenta Cliente', width: '140px' },
      { key: 'cta_chq_dev', label: 'Cta. Cheque Dev.', width: '150px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListTcontable(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveTcontable({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteTcontable(noCia, item.tipo_conta)}
  />
}

// ─── FCXC111 Ciudades ─────────────────────────────────────────────────────────
export function CxcCiudades({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC111 — Mantenimiento de Ciudades"
    idFields={['no_cia', 'ciudad']}
    noCia={noCia}
    fields={[
      { key: 'ciudad', label: 'Código', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListCiudades(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveCiudad({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteCiudad(noCia, item.ciudad)}
  />
}

// ─── FCXC112 Barrios ──────────────────────────────────────────────────────────
export function CxcBarrios({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC112 — Mantenimiento de Sectores / Barrios"
    idFields={['no_cia', 'barrio']}
    noCia={noCia}
    fields={[
      { key: 'barrio', label: 'Código', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'ciudad', label: 'Ciudad', width: '80px' },
      { key: 'desc_ciudad', label: 'Nombre Ciudad', readOnly: true },
    ]}
    fetchFn={() => regalGeneralApi.cxcListBarrios(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveBarrio({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteBarrio(noCia, item.barrio)}
  />
}

// ─── FCXC113 Zonas ────────────────────────────────────────────────────────────
export function CxcZonas({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC113 — Mantenimiento de Zonas"
    idFields={['no_cia', 'zona']}
    noCia={noCia}
    fields={[
      { key: 'zona', label: 'Código', width: '80px' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'tipo_zona', label: 'Tipo Zona', width: '100px' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListZonas(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveZona({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteZona(noCia, item.zona)}
  />
}

// ─── FCXC114 Cadenas ──────────────────────────────────────────────────────────
export function CxcCadenas({ noCia }: P) {
  return <CatalogoCrud
    title="FCXC114 — Mantenimiento de Cadenas de Negocios"
    idFields={['no_cia', 'cadena']}
    noCia={noCia}
    fields={[
      { key: 'cadena', label: 'Código', width: '80px' },
      { key: 'nombre', label: 'Nombre' },
    ]}
    fetchFn={() => regalGeneralApi.cxcListCadenas(noCia)}
    saveFn={data => regalGeneralApi.cxcSaveCadena({ ...data, no_cia: noCia })}
    deleteFn={item => regalGeneralApi.cxcDeleteCadena(noCia, item.cadena)}
  />
}
