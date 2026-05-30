import axios from 'axios';

const API_BASE_URL = 'http://10.0.0.99:8000/api/fat';

// Tipos
export interface FATFactura {
  no_cia: string;
  punto: string;
  tipo_factura: string;
  no_factura: string;
  no_cliente: number;
  fecha: string;
  vendedor?: string;
  afecta_cxc: string;
  tasa_us: number;
  porc_impuesto: number;
  descuento: number;
  impuesto: number;
  total_linea: number;
  total_neto: number;
  estado: 'P' | 'A' | 'C';
  usuario?: string;
  st_generado_cnt: string;
  st_impresion: string;
  st_anulado: string;
  tipo_transaccion: string;
  plazo_pago: number;
  forma_pago: string;
  ncf?: number;
  posiciones_fijas_ncf?: string;
  ncf_dgi?: string;
  codigo_ncf?: string;
  tipo_ncf_fiscal?: string;
  cajero?: string;
  valor_recibido?: number;
  valor_devuelto?: number;
  propina: number;
  ruta?: string;
  no_condicion_pago?: string;
  detalle?: string;
  nota?: string;
  fecha_impresion?: string;
  fecha_venta?: string;
  tipo_moneda: string;
  lineas?: FATFacturaL[];
}

export interface FATFacturaL {
  no_linea: number;
  no_produ: string;
  descripcion?: string;
  almacen: string;
  cantidad: number;
  precio: number;
  costo: number;
  precio_de_lista?: number;
  porc_descuento: number;
  descuento: number;
  porciento_impuesto: number;
  impuesto: number;
  monto_neto: number;
  empaque: number;
  cantidad_porciones?: number;
  no_lote?: string;
  cantidad_regalia: number;
  st_anulado: string;
}

export interface FATConduce {
  no_cia: string;
  punto: string;
  tipo_conduce: string;
  no_conduce: string;
  no_cliente: number;
  fecha: string;
  vendedor?: string;
  tipo_moneda: string;
  tasa_us: number;
  descuento: number;
  impuesto: number;
  total_linea: number;
  total_neto: number;
  st_anulado: string;
  autorizado: string;
  detalle?: string;
  usuario?: string;
}

export interface FATCondicionPago {
  no_condicion: string;
  descripcion: string;
  dias: number;
}

export interface FATListaPrecio {
  no_lista: string;
  descripcion: string;
  no_produ: string;
  precio: number;
  fecha_vigencia: string;
  activa: string;
}

export interface FATTdocu {
  tipo_doc: string;
  descripcion: string;
  codigo_ncf: string;
  tipo_transaccion: string;
  afecta_cxc: string;
  activo: string;
  ncf_inicial: number;
  ncf_final: number;
  prox_ncf: number;
}

// Cliente API
class FATApi {
  private axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, // Enviar cookies HttpOnly
  });

  // FACTURAS
  async listFacturas(params?: any) {
    const response = await this.axiosInstance.get('/facturas/', { params });
    return response.data;
  }

  async getFactura(noFactura: string) {
    const response = await this.axiosInstance.get(`/facturas/${noFactura}/`);
    return response.data;
  }

  async createFactura(data: Partial<FATFactura>) {
    const response = await this.axiosInstance.post('/facturas/', data);
    return response.data;
  }

  async updateFactura(noFactura: string, data: Partial<FATFactura>) {
    const response = await this.axiosInstance.patch(`/facturas/${noFactura}/`, data);
    return response.data;
  }

  async deleteFactura(noFactura: string) {
    const response = await this.axiosInstance.delete(`/facturas/${noFactura}/`);
    return response.data;
  }

  async generarFactura(noFactura: string) {
    const response = await this.axiosInstance.post(`/facturas/${noFactura}/generar/`);
    return response.data;
  }

  async anularFactura(noFactura: string) {
    const response = await this.axiosInstance.post(`/facturas/${noFactura}/anular/`);
    return response.data;
  }

  async imprimirFactura(noFactura: string) {
    const response = await this.axiosInstance.post(`/facturas/${noFactura}/imprimir/`);
    return response.data;
  }

  // LÍNEAS
  async listLineas(params?: any) {
    const response = await this.axiosInstance.get('/lineas/', { params });
    return response.data;
  }

  async addLinea(data: Partial<FATFacturaL>) {
    const response = await this.axiosInstance.post('/lineas/', data);
    return response.data;
  }

  async updateLinea(lineaId: number, data: Partial<FATFacturaL>) {
    const response = await this.axiosInstance.patch(`/lineas/${lineaId}/`, data);
    return response.data;
  }

  async deleteLinea(lineaId: number) {
    const response = await this.axiosInstance.delete(`/lineas/${lineaId}/`);
    return response.data;
  }

  // CONDUCES
  async listConduces(params?: any) {
    const response = await this.axiosInstance.get('/conduces/', { params });
    return response.data;
  }

  async createConduce(data: Partial<FATConduce>) {
    const response = await this.axiosInstance.post('/conduces/', data);
    return response.data;
  }

  async convertirFactura(noConduce: string) {
    const response = await this.axiosInstance.post(`/conduces/${noConduce}/convertir_factura/`);
    return response.data;
  }

  // CATÁLOGOS
  async listCondicionesPago() {
    const response = await this.axiosInstance.get('/condiciones-pago/');
    return response.data;
  }

  async listListasPrecios(params?: any) {
    const response = await this.axiosInstance.get('/listas-precio/', { params });
    return response.data;
  }

  async listTiposDocumento() {
    const response = await this.axiosInstance.get('/tipos-documento/');
    return response.data;
  }

  // REPORTES
  async reporteVentas(params?: any) {
    const response = await this.axiosInstance.get('/reportes_ventas/', { params });
    return response.data;
  }
}

export const fatApi = new FATApi();
