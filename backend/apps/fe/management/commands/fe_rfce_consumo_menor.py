"""Management command de UNA SOLA VEZ (Task 5b) para el Paso 2 de la
certificación real DGII (solicitud 81443, Abregonza RNC 130217432):

Envía los 4 RFCE (Resumen de Factura de Consumo Electrónica) de la hoja
``RFCE`` del Set de Pruebas -- e-NCF ``E320000000012/013/014/015``, mismo
"Tercero" del orden de emisión documentado en
``docs/superpowers/reference/2026-08-31-set-pruebas-paso2/
resultados-paso2-20260904/README.md`` hallazgo #4 -- y deja en disco, para
cada escenario, el e-CF32 completo YA FIRMADO y listo para el "Cuarto"
paso: la carga MANUAL por el widget "Facturas de consumo < 250Mil" del
portal de certificación (``https://ecf.dgii.gov.do/certecf/
portalcertificacion/Postulacion/Pruebas``) -- este comando NO intenta esa
carga, es una acción de navegador que hace el controlador.

No es un endpoint permanente (a diferencia de ``pruebas_enviar_view`` /
Task 5 Step 1) porque el envío del RFCE de un e-NCF fijo del Set de Pruebas
es, por diseño de la DGII, una acción de una sola vez por e-NCF (el e-NCF
se consume/quema al primer envío sin importar el resultado -- ver
README.md hallazgo #3) -- no tiene sentido exponerlo como botón reutilizable
en la UI de producción.

Uso (SIEMPRE contra testecf, nunca configurable -- ver ``_AMBIENTE``):

    python manage.py fe_rfce_consumo_menor --no_cia 01 \
        --outdir /tmp/rfce-task5b

    python manage.py fe_rfce_consumo_menor --dry-run  # arma+firma+valida
        # localmente pero NO llama a dgii_client.enviar_rfce -- usar antes
        # del envío real para confirmar que no hay sorpresas de firma/red.

Datos de los 4 escenarios: extraídos programáticamente de
``set-pruebas-130217432.xlsx`` (hojas ``ECF`` y ``RFCE``) el 2026-09-08 --
ver ``_ESCENARIOS`` abajo. Aplica el MISMO gotcha de RNC ya documentado y
usado en los otros 21 escenarios ya enviados (README.md hallazgo #2):
``RNCComprador`` real del Excel (``131880681`` / "DOCUMENTOS ELECTRONICOS
DE 03") no es un contribuyente activo -- sustituido por ``130941361`` / "RC
HERNANDEZ SRL" en AMBOS documentos (e-CF32 y RFCE), consistentemente
(deben coincidir, ver README.md hallazgo #3 sobre validación cruzada).
"""
from __future__ import annotations

import json
import os
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

from apps.fe import dgii_client, ecf_builder

# Hardcodeado a proposito, igual que apps.fe.views._AMBIENTE_MODO_TEST -- el
# Set de Pruebas de certificacion SIEMPRE va contra testecf, nunca
# certecf/ecf, sin importar TFE_CONFIG.ambiente de la cia.
_AMBIENTE = 'testecf'

# RNC real activo que sustituye 131880681 ("DOCUMENTOS ELECTRONICOS DE 03",
# no es contribuyente activo) en RNCComprador/RazonSocialComprador de los 4
# escenarios -- mismo valor ya usado y confirmado en los otros 21 escenarios
# de este mismo Set de Pruebas (ver README.md hallazgo #2, segundo.json en
# la VM).
_RNC_COMPRADOR_ACTIVO = '130941361'
_RAZON_COMPRADOR_ACTIVO = 'RC HERNANDEZ SRL'

# Datos COMPLETOS del e-CF32 (hoja ECF), uno por escenario -- el diccionario
# aplanado con notacion de corchetes que espera
# ``ecf_builder.construir_ecf_generico`` (mismos nombres de columna que el
# Excel real, ver NOTAS.md seccion 5). RNCComprador/RazonSocialComprador YA
# vienen sustituidos (ver docstring del modulo).
_ESCENARIOS = {
    'E320000000012': {
        'ecf': {
            'IndicadorMontoGravado': '0',
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'NombreComercial': 'DOCUMENTOS ELECTRONICOS',
            'DireccionEmisor': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'TelefonoEmisor[1]': '809-472-7676',
            'CorreoEmisor': 'DOCUMENTOSELECTRONICOS@123.COM',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'CorreoComprador': 'DOCUMENTOSELECTRONICOSDE0612345678969789@123.COM',
            'DireccionComprador': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'MunicipioComprador': '030307',
            'ProvinciaComprador': '030000',
            'TelefonoAdicional': '809-472-7676',
            'MontoGravadoTotal': '40000.00',
            'MontoGravadoI1': '40000.00',
            'ITBIS1': '18',
            'TotalITBIS': '7200.00',
            'TotalITBIS1': '7200.00',
            'MontoTotal': '47200.00',
            'NumeroLinea[1]': '1',
            'IndicadorFacturacion[1]': '1',
            'NombreItem[1]': 'Estufa',
            'IndicadorBienoServicio[1]': '1',
            'CantidadItem[1]': '1',
            'UnidadMedida[1]': '55',
            'PrecioUnitarioItem[1]': '40000.00',
            'MontoItem[1]': '40000.00',
        },
        'rfce': {
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'MontoGravadoTotal': '40000.00',
            'MontoGravadoI1': '40000.00',
            'TotalITBIS': '7200.00',
            'TotalITBIS1': '7200.00',
            'MontoTotal': '47200.00',
        },
    },
    'E320000000013': {
        'ecf': {
            'IndicadorMontoGravado': '0',
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'NombreComercial': 'DOCUMENTOS ELECTRONICOS',
            'DireccionEmisor': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'TelefonoEmisor[1]': '809-472-7676',
            'CorreoEmisor': 'DOCUMENTOSELECTRONICOS@123.COM',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'CorreoComprador': 'DOCUMENTOSELECTRONICOSDE0612345678969789@123.COM',
            'DireccionComprador': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'MunicipioComprador': '170203',
            'ProvinciaComprador': '170000',
            'TelefonoAdicional': '809-472-7676',
            'MontoGravadoTotal': '95000.00',
            'MontoGravadoI1': '95000.00',
            'ITBIS1': '18',
            'TotalITBIS': '17100.00',
            'TotalITBIS1': '17100.00',
            'MontoTotal': '112100.00',
            'NumeroLinea[1]': '1',
            'IndicadorFacturacion[1]': '1',
            'NombreItem[1]': 'Nevera',
            'IndicadorBienoServicio[1]': '1',
            'CantidadItem[1]': '1',
            'UnidadMedida[1]': '55',
            'PrecioUnitarioItem[1]': '95000.00',
            'MontoItem[1]': '95000.00',
        },
        'rfce': {
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'MontoGravadoTotal': '95000.00',
            'MontoGravadoI1': '95000.00',
            'TotalITBIS': '17100.00',
            'TotalITBIS1': '17100.00',
            'MontoTotal': '112100.00',
        },
    },
    'E320000000014': {
        'ecf': {
            'IndicadorMontoGravado': '0',
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'NombreComercial': 'DOCUMENTOS ELECTRONICOS',
            'DireccionEmisor': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'TelefonoEmisor[1]': '809-472-7676',
            'CorreoEmisor': 'DOCUMENTOSELECTRONICOS@123.COM',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'CorreoComprador': 'DOCUMENTOSELECTRONICOSDE0612345678969789@123.COM',
            'DireccionComprador': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'MunicipioComprador': '170203',
            'ProvinciaComprador': '170000',
            'TelefonoAdicional': '809-472-7676',
            'MontoGravadoTotal': '10100.00',
            'MontoGravadoI1': '10100.00',
            'ITBIS1': '18',
            'TotalITBIS': '1818.00',
            'TotalITBIS1': '1818.00',
            'MontoTotal': '11918.00',
            'NumeroLinea[1]': '1',
            'IndicadorFacturacion[1]': '1',
            'NombreItem[1]': 'Articulos de belleza',
            'IndicadorBienoServicio[1]': '1',
            'CantidadItem[1]': '1',
            'UnidadMedida[1]': '55',
            'PrecioUnitarioItem[1]': '10000.00',
            'MontoItem[1]': '10000.00',
            'NumeroLinea[2]': '2',
            'IndicadorFacturacion[2]': '1',
            'NombreItem[2]': 'Queso',
            'IndicadorBienoServicio[2]': '1',
            'CantidadItem[2]': '1',
            'UnidadMedida[2]': '23',
            'PrecioUnitarioItem[2]': '100.00',
            'MontoItem[2]': '100.00',
        },
        'rfce': {
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'MontoGravadoTotal': '10100.00',
            'MontoGravadoI1': '10100.00',
            'TotalITBIS': '1818.00',
            'TotalITBIS1': '1818.00',
            'MontoTotal': '11918.00',
        },
    },
    'E320000000015': {
        'ecf': {
            'IndicadorMontoGravado': '0',
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'NombreComercial': 'DOCUMENTOS ELECTRONICOS',
            'DireccionEmisor': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'TelefonoEmisor[1]': '809-472-7676',
            'CorreoEmisor': 'DOCUMENTOSELECTRONICOS@123.COM',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'CorreoComprador': 'DOCUMENTOSELECTRONICOSDE0612345678969789@123.COM',
            'DireccionComprador': 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
            'MunicipioComprador': '170203',
            'ProvinciaComprador': '170000',
            'TelefonoAdicional': '809-472-7676',
            'MontoGravadoTotal': '55000.00',
            'MontoGravadoI1': '55000.00',
            'ITBIS1': '18',
            'TotalITBIS': '9900.00',
            'TotalITBIS1': '9900.00',
            'MontoTotal': '64900.00',
            'NumeroLinea[1]': '1',
            'IndicadorFacturacion[1]': '1',
            'NombreItem[1]': 'Celular',
            'IndicadorBienoServicio[1]': '1',
            'CantidadItem[1]': '1',
            'UnidadMedida[1]': '55',
            'PrecioUnitarioItem[1]': '50000.00',
            'MontoItem[1]': '50000.00',
            'NumeroLinea[2]': '2',
            'IndicadorFacturacion[2]': '1',
            'NombreItem[2]': 'Cargador',
            'IndicadorBienoServicio[2]': '1',
            'CantidadItem[2]': '1',
            'UnidadMedida[2]': '23',
            'PrecioUnitarioItem[2]': '5000.00',
            'MontoItem[2]': '5000.00',
        },
        'rfce': {
            'TipoIngresos': '01',
            'TipoPago': '1',
            'RNCEmisor': '130217432',
            'RazonSocialEmisor': 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
            'FechaEmision': '01-04-2020',
            'RNCComprador': _RNC_COMPRADOR_ACTIVO,
            'RazonSocialComprador': _RAZON_COMPRADOR_ACTIVO,
            'MontoGravadoTotal': '55000.00',
            'MontoGravadoI1': '55000.00',
            'TotalITBIS': '9900.00',
            'TotalITBIS1': '9900.00',
            'MontoTotal': '64900.00',
        },
    },
}


class Command(BaseCommand):
    help = (
        "Task 5b (Paso 2 certificacion DGII, hoja RFCE): arma+firma el "
        "e-CF32 y el RFCE de las 4 Facturas de Consumo < RD$250,000 "
        "(E320000000012/013/014/015), envia el RFCE a testecf y deja el "
        "e-CF32 firmado en disco para la carga manual al portal."
    )

    def add_arguments(self, parser):
        parser.add_argument('--no_cia', default='01',
                            help="Compania en TFE_CONFIG (default: 01, Abregonza)")
        parser.add_argument('--outdir', default='/tmp/rfce-task5b',
                            help="Directorio base donde guardar los XML/JSON "
                                 "de salida (default: /tmp/rfce-task5b)")
        parser.add_argument('--dry-run', action='store_true',
                            help="Arma, firma y valida localmente pero NO "
                                 "llama a dgii_client.enviar_rfce (no toca "
                                 "la red/DGII)")
        parser.add_argument('--solo', default=None,
                            help="Procesar un solo eNCF (p.ej. "
                                 "E320000000012) en vez de los 4")

    def handle(self, *args, **options):
        no_cia = options['no_cia']
        outdir_base = options['outdir']
        dry_run = options['dry_run']
        solo = options['solo']

        escenarios = _ESCENARIOS
        if solo:
            if solo not in _ESCENARIOS:
                raise CommandError(
                    f"--solo {solo!r} no es uno de los 4 eNCF conocidos: "
                    f"{sorted(_ESCENARIOS)}")
            escenarios = {solo: _ESCENARIOS[solo]}

        os.makedirs(outdir_base, exist_ok=True)
        resumen = []

        for e_ncf, payload in escenarios.items():
            self.stdout.write(self.style.NOTICE(f'=== {e_ncf} ==='))
            outdir = os.path.join(outdir_base, e_ncf)
            os.makedirs(outdir, exist_ok=True)

            # 1) Construir + firmar el e-CF32 COMPLETO (misma logica que
            #    Task 5 Step 1 -- construir_ecf_generico -- pero este XML
            #    NO se envia via dgii_client.enviar_ecf: las Facturas de
            #    Consumo < RD$250,000 no pasan por ese servicio, ver
            #    dgii_client.enviar_ecf docstring y Descripcion-Tecnica-
            #    Servicios-DGII.pdf "Recepcion de e-CF").
            try:
                ecf_sin_firmar = ecf_builder.construir_ecf_generico(
                    32, e_ncf, payload['ecf'])
            except ecf_builder.ECFBuilderError as exc:
                raise CommandError(f'{e_ncf}: error armando e-CF32: {exc}') from exc

            # _firmar_para_envio es "privada" (prefijo _) porque
            # dgii_client no expone hoy un "firmar sin enviar" publico --
            # todo el resto del cliente firma Y envia en la misma llamada
            # (enviar_ecf/enviar_rfce). Aqui se necesita el XML firmado
            # SIN enviarlo por el servicio de Recepcion de e-CF (ver
            # parrafo anterior), asi que se llama directo a proposito.
            try:
                ecf_firmado, rnc_emisor = dgii_client._firmar_para_envio(
                    no_cia, ecf_sin_firmar)
            except dgii_client.DgiiError as exc:
                raise CommandError(f'{e_ncf}: error firmando e-CF32: {exc}') from exc

            # 2) Derivar CodigoSeguridadeCF del e-CF32 YA FIRMADO (ver
            #    ecf_builder.derivar_codigo_seguridad para la fuente
            #    documentada del algoritmo).
            codigo_seguridad = ecf_builder.derivar_codigo_seguridad(ecf_firmado)
            self.stdout.write(f'  CodigoSeguridadeCF derivado: {codigo_seguridad}')

            # 3) Construir el RFCE incluyendo ese codigo.
            try:
                rfce_sin_firmar = ecf_builder.construir_rfce(
                    e_ncf, payload['rfce'], codigo_seguridad)
            except ecf_builder.ECFBuilderError as exc:
                raise CommandError(f'{e_ncf}: error armando RFCE: {exc}') from exc

            # 4) Guardar SIEMPRE el e-CF32 firmado (aunque sea dry-run) --
            #    es el artefacto que el controlador va a subir manualmente
            #    al portal en el paso "Cuarto", nombre de archivo segun el
            #    estandar oficial RNC+eNCF (Descripcion-Tecnica-Servicios-
            #    DGII.pdf "Recepcion de e-CF").
            ecf_path = os.path.join(outdir, f'{rnc_emisor}{e_ncf}.xml')
            with open(ecf_path, 'w', encoding='utf-8') as f:
                f.write(ecf_firmado)
            self.stdout.write(f'  e-CF32 firmado guardado en: {ecf_path}')

            resultado_item = {
                'e_ncf': e_ncf,
                'codigo_seguridad': codigo_seguridad,
                'ecf32_firmado_path': ecf_path,
                'dry_run': dry_run,
            }

            if dry_run:
                self.stdout.write(self.style.WARNING(
                    '  --dry-run: RFCE armado pero NO enviado a testecf'))
                rfce_path = os.path.join(outdir, 'rfce-sin-firmar.xml')
                with open(rfce_path, 'w', encoding='utf-8') as f:
                    f.write(rfce_sin_firmar)
                resultado_item['rfce_sin_firmar_path'] = rfce_path
            else:
                # 5) Enviar el RFCE a testecf (firma internamente, ver
                #    dgii_client.enviar_rfce -- respuesta SINCRONA, ya trae
                #    estado Aceptado/Aceptado condicional/Rechazado, no hay
                #    trackId ni consultar_estado posterior para RFCE).
                try:
                    resultado = dgii_client.enviar_rfce(
                        no_cia, _AMBIENTE, e_ncf, rfce_sin_firmar)
                except dgii_client.DgiiError as exc:
                    raise CommandError(
                        f'{e_ncf}: error enviando RFCE a {_AMBIENTE}: {exc}') from exc

                self.stdout.write(
                    f"  RFCE enviado -- estado={resultado['estado']!r} "
                    f"codigo={resultado['codigo']!r} "
                    f"secuenciaUtilizada={resultado['secuencia_utilizada']!r}")
                if resultado.get('mensajes'):
                    self.stdout.write(f"  mensajes: {resultado['mensajes']}")

                resultado_item.update({
                    'estado': resultado['estado'],
                    'codigo': resultado['codigo'],
                    'mensajes': resultado['mensajes'],
                    'encf_respuesta': resultado['encf'],
                    'secuencia_utilizada': resultado['secuencia_utilizada'],
                    'respuesta_cruda': resultado['respuesta_cruda'],
                })

                rfce_firmado_path = os.path.join(outdir, 'rfce-firmado.xml')
                with open(rfce_firmado_path, 'w', encoding='utf-8') as f:
                    f.write(resultado['xml_firmado'])
                resultado_item['rfce_firmado_path'] = rfce_firmado_path

            resultado_path = os.path.join(outdir, 'resultado.json')
            with open(resultado_path, 'w', encoding='utf-8') as f:
                json.dump(resultado_item, f, ensure_ascii=False, indent=2, default=str)
            resumen.append(resultado_item)

        resumen_path = os.path.join(
            outdir_base,
            f"resumen-{datetime.now():%Y%m%d-%H%M%S}.json")
        with open(resumen_path, 'w', encoding='utf-8') as f:
            json.dump(resumen, f, ensure_ascii=False, indent=2, default=str)
        self.stdout.write(self.style.SUCCESS(f'Resumen guardado en: {resumen_path}'))
