"""Inyecta el bloque NotaDetalle en plantillas Puck guardadas que no lo tengan.

Aplica a `FAT.TFAT_PLANTILLA_PDF` para los codigo_doc de la familia "documento"
listados abajo. El bloque se inserta:
  - antes de `Firmas` si existe
  - sino antes de `FooterEmpresa`
  - sino antes de `QRCode` (caso POS)
  - sino al final del array content

Cada upsert pasa por `upsert_plantilla` del repo y queda registrado en
`TFAT_PLANTILLA_PDF_HIST` con una nueva versión, así que el rollback es trivial
con `POST /api/settings/plantillas-pdf/<codigo>/rollback/?version=N`.

Uso (dentro del container backend):
    docker exec facturation_backend python /app/scripts/inject_nota_detalle.py
"""
from __future__ import annotations

import json
import os
import sys

# Bootstrap Django.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'facturation_api.settings')
sys.path.insert(0, '/app')
import django  # noqa: E402

django.setup()

from apps.legacy.repositories import plantillas_pdf_repo  # noqa: E402


CODIGOS = [
    ('orden-compra',       'Observaciones:'),
    ('requisicion-compra', 'Justificación / observaciones:'),
    ('factura',            'Nota:'),
    ('factura-pos',        'Nota:'),
    ('conduce',            'Detalle:'),
    ('cotizacion',         'Detalle:'),
    ('inv-documento',      'Observación:'),
    ('acc-documento',      'Observación:'),
    ('cxp-documento',      'Observación:'),
    ('cxc-documento',      'Observación:'),
]


def make_block(titulo: str) -> dict:
    return {
        'type': 'NotaDetalle',
        'props': {'id': 'nota-auto', 'titulo': titulo, 'mostrarSiVacio': False},
    }


def find_anchor_idx(blocks: list[dict]) -> int:
    """Posición donde insertar el NotaDetalle.

    Preferencia: antes de Firmas → antes de FooterEmpresa → antes de QRCode → final.
    """
    for i, b in enumerate(blocks):
        if (b or {}).get('type') == 'Firmas':
            return i
    for i, b in enumerate(blocks):
        if (b or {}).get('type') == 'FooterEmpresa':
            return i
    for i, b in enumerate(blocks):
        if (b or {}).get('type') == 'QRCode':
            return i
    return len(blocks)


def process_all(no_cia: str = '01', usuario: str = 'AUTO-MIGRATION') -> None:
    inyectadas = saltadas = no_personalizadas = 0
    for codigo, titulo in CODIGOS:
        plantilla = plantillas_pdf_repo.get_plantilla(no_cia, codigo)
        if plantilla is None or plantilla.get('definicion_json') is None:
            no_personalizadas += 1
            print(f"  · {codigo:25s} sin plantilla guardada — usará el default actualizado")
            continue

        defjs = plantilla['definicion_json']
        try:
            df = json.loads(defjs) if isinstance(defjs, str) else defjs
        except json.JSONDecodeError:
            print(f"  ! {codigo:25s} JSON inválido — saltado")
            continue

        content = df.get('content') or []
        types = [(b or {}).get('type') for b in content]
        if 'NotaDetalle' in types:
            saltadas += 1
            print(f"  ✓ {codigo:25s} ya tiene NotaDetalle (v={plantilla.get('version')})")
            continue

        idx = find_anchor_idx(content)
        content.insert(idx, make_block(titulo))
        df['content'] = content

        plantillas_pdf_repo.upsert_plantilla(
            no_cia=no_cia,
            codigo_doc=codigo,
            nombre=plantilla.get('nombre') or codigo,
            definicion_json=json.dumps(df, ensure_ascii=False),
            page_size=(plantilla.get('page_size') or 'A4').upper(),
            page_orientation=(plantilla.get('page_orientation') or 'P').upper(),
            activo=bool(plantilla.get('activo', True)),
            usuario=usuario,
        )
        inyectadas += 1
        print(f"  + {codigo:25s} NotaDetalle inyectado en idx={idx} (nueva v)")

    print(
        f"\nResumen: inyectadas={inyectadas} ya_tenian={saltadas} "
        f"sin_plantilla={no_personalizadas}"
    )


if __name__ == '__main__':
    no_cia = sys.argv[1] if len(sys.argv) > 1 else '01'
    print(f"Inyectando NotaDetalle en plantillas guardadas (no_cia={no_cia})…\n")
    process_all(no_cia=no_cia)
