import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fatApi, FATFactura, FATFacturaL } from '@/services/fat-api';

interface UseFacturasOptions {
  filters?: Record<string, any>;
  page?: number;
  pageSize?: number;
}

export function useFacturas(options?: UseFacturasOptions) {
  const [facturas, setFacturas] = useState<FATFactura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...options?.filters,
        page: options?.page || 1,
        page_size: options?.pageSize || 20,
      };
      const response = await fatApi.listFacturas(params);
      setFacturas(response.results || response);
      setTotal(response.count || response.length);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Error al cargar facturas';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [options?.filters, options?.page, options?.pageSize]);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  return {
    facturas,
    loading,
    error,
    total,
    refresh: loadFacturas,
  };
}

export function useFacturaForm() {
  const [factura, setFactura] = useState<Partial<FATFactura> | null>(null);
  const [lineas, setLineas] = useState<Partial<FATFacturaL>[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculandoTotales, setCalculandoTotales] = useState(false);

  // Calcular totales automáticamente
  const calcularTotales = useCallback(() => {
    setCalculandoTotales(true);
    try {
      let totalLinea = 0;
      let totalDescuento = 0;
      let totalImpuesto = 0;

      for (const linea of lineas) {
        if (!linea.cantidad || !linea.precio) continue;

        const monto = (linea.cantidad || 0) * (linea.precio || 0);
        const descuento = monto * ((linea.porc_descuento || 0) / 100);
        const montoConDesc = monto - descuento;
        const impuesto = montoConDesc * ((linea.porciento_impuesto || 18) / 100);

        totalLinea += monto;
        totalDescuento += descuento;
        totalImpuesto += impuesto;
      }

      setFactura((prev) => ({
        ...prev,
        total_linea: totalLinea,
        descuento: totalDescuento,
        impuesto: totalImpuesto,
        total_neto: totalLinea - totalDescuento + totalImpuesto,
      }));
    } finally {
      setCalculandoTotales(false);
    }
  }, [lineas]);

  // Agregar línea
  const agregarLinea = useCallback((linea: Partial<FATFacturaL>) => {
    const noLinea = (lineas.length || 0) + 1;
    setLineas((prev) => [
      ...prev,
      {
        ...linea,
        no_linea: noLinea,
        st_anulado: 'N',
      },
    ]);
  }, [lineas.length]);

  // Editar línea
  const editarLinea = useCallback((noLinea: number, datos: Partial<FATFacturaL>) => {
    setLineas((prev) =>
      prev.map((linea) =>
        linea.no_linea === noLinea ? { ...linea, ...datos } : linea
      )
    );
  }, []);

  // Eliminar línea
  const eliminarLinea = useCallback((noLinea: number) => {
    setLineas((prev) => prev.filter((linea) => linea.no_linea !== noLinea));
  }, []);

  // Guardar factura
  const guardarFactura = useCallback(
    async (datos: Partial<FATFactura>) => {
      setLoading(true);
      try {
        if (lineas.length === 0) {
          toast.error('Debe agregar al menos una línea');
          return null;
        }

        const payload = {
          ...datos,
          lineas,
        };

        const response = await fatApi.createFactura(payload);
        toast.success(`Factura ${response.no_factura} creada correctamente`);
        return response;
      } catch (err: any) {
        const message = err.response?.data?.error || 'Error al guardar factura';
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [lineas]
  );

  // Generar (autorizar)
  const generar = useCallback(
    async (noFactura: string) => {
      setLoading(true);
      try {
        await fatApi.generarFactura(noFactura);
        toast.success('Factura autorizada correctamente');
        return true;
      } catch (err: any) {
        const message = err.response?.data?.error || 'Error al autorizar';
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Anular
  const anular = useCallback(
    async (noFactura: string) => {
      setLoading(true);
      try {
        await fatApi.anularFactura(noFactura);
        toast.success('Factura anulada correctamente');
        return true;
      } catch (err: any) {
        const message = err.response?.data?.error || 'Error al anular';
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Imprimir
  const imprimir = useCallback(
    async (noFactura: string) => {
      setLoading(true);
      try {
        await fatApi.imprimirFactura(noFactura);
        toast.success('Factura marcada como impresa');
        return true;
      } catch (err: any) {
        const message = err.response?.data?.error || 'Error al imprimir';
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    factura,
    setFactura,
    lineas,
    agregarLinea,
    editarLinea,
    eliminarLinea,
    calcularTotales,
    calculandoTotales,
    guardarFactura,
    generar,
    anular,
    imprimir,
    loading,
  };
}
