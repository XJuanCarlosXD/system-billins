"""Backfill de existencia legacy para facturas creadas antes del fix.

El bug fue que la factura nueva insertaba INV.TINV_MOVIMIENTO, pero no
actualizaba INV.TINV_EPRODUCTO.EXIST_ACTUAL, que es el saldo que ve Oracle
Forms. Este script aplica ese faltante para documentos acotados.

Uso seguro:
  python scripts/backfill_fat_invoice_stock.py --desde "2026-07-01 00:00:00" --hasta "2026-07-02 14:30:00"
  python scripts/backfill_fat_invoice_stock.py --docs "FT-12345,FC-12346" --apply --confirm DESCONTAR
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")

import django  # noqa: E402

django.setup()

from apps.legacy import client  # noqa: E402


def _parse_doc(doc: str) -> tuple[str, str]:
    raw = (doc or "").strip().upper()
    if "-" not in raw:
        raise ValueError(f"Documento invalido: {doc}. Usa TIPO-NUMERO, ej. FT-12345")
    tipo, numero = raw.split("-", 1)
    tipo = tipo.strip()
    numero = numero.strip()
    if not tipo or not numero:
        raise ValueError(f"Documento invalido: {doc}. Usa TIPO-NUMERO, ej. FT-12345")
    return tipo, numero


def _build_where(args: argparse.Namespace) -> tuple[list[str], dict]:
    where = [
        "NVL(f.st_anulado,'N') = 'N'",
        "NVL(m.st_anulado,'N') = 'N'",
        "m.tipo_movi = 'S'",
    ]
    binds: dict[str, object] = {}

    if args.no_cia:
        where.append("f.no_cia = :no_cia")
        binds["no_cia"] = args.no_cia
    if args.punto:
        where.append("f.punto = :punto")
        binds["punto"] = args.punto
    if args.usuario:
        where.append("UPPER(f.usuario) = UPPER(:usuario)")
        binds["usuario"] = args.usuario
    if args.docs:
        parts = []
        for idx, doc in enumerate(args.docs.split(",")):
            tipo, numero = _parse_doc(doc)
            binds[f"tipo_{idx}"] = tipo
            binds[f"numero_{idx}"] = numero
            parts.append(f"(f.tipo_factura = :tipo_{idx} AND f.no_factura = :numero_{idx})")
        where.append("(" + " OR ".join(parts) + ")")
    else:
        if not args.desde or not args.hasta:
            raise ValueError("Sin --docs debes indicar --desde y --hasta por fecha_sysdate")
        where.append("f.fecha_sysdate >= TO_DATE(:desde, 'YYYY-MM-DD HH24:MI:SS')")
        where.append("f.fecha_sysdate < TO_DATE(:hasta, 'YYYY-MM-DD HH24:MI:SS')")
        binds["desde"] = args.desde
        binds["hasta"] = args.hasta

    return where, binds


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Aplica a TINV_EPRODUCTO el descuento faltante de facturas FAT."
    )
    parser.add_argument("--desde", help="Fecha/hora inicio f.fecha_sysdate: YYYY-MM-DD HH24:MI:SS")
    parser.add_argument("--hasta", help="Fecha/hora fin exclusiva f.fecha_sysdate: YYYY-MM-DD HH24:MI:SS")
    parser.add_argument("--docs", help="Lista TIPO-NUMERO separada por coma. Ej: FT-12345,FC-12346")
    parser.add_argument("--no-cia", default="", help="Filtrar compania")
    parser.add_argument("--punto", default="", help="Filtrar punto")
    parser.add_argument("--usuario", default="", help="Filtrar usuario de factura")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios. Sin esto es dry-run.")
    parser.add_argument("--confirm", default="", help="Para --apply debe ser DESCONTAR")
    args = parser.parse_args()
    if args.apply and args.confirm != "DESCONTAR":
        raise ValueError("Para aplicar cambios usa --apply --confirm DESCONTAR")

    where, binds = _build_where(args)
    sql = (
        "SELECT m.no_cia, m.punto, m.almacen, m.no_produ, "
        "       SUM(NVL(m.cantidad,0)) AS cantidad, COUNT(*) AS lineas "
        "FROM FAT.TFAT_FACTURA f "
        "JOIN INV.TINV_MOVIMIENTO m "
        "  ON m.no_cia=f.no_cia AND m.punto=f.punto "
        " AND m.tipo_docu=f.tipo_factura AND m.no_docu=f.no_factura "
        f"WHERE {' AND '.join(where)} "
        "GROUP BY m.no_cia, m.punto, m.almacen, m.no_produ "
        "ORDER BY m.no_cia, m.punto, m.almacen, m.no_produ"
    )

    rows = client.fetch_dicts(sql, binds)
    total = sum(float(r["cantidad"] or 0) for r in rows)
    print(f"Modo: {'APPLY' if args.apply else 'DRY-RUN'}")
    print(f"Filas producto/almacen: {len(rows)}")
    print(f"Cantidad total a descontar: {total:.2f}")
    for r in rows:
        print(
            f"{r['no_cia']} {r['punto']} alm={r['almacen']} "
            f"prod={r['no_produ']} qty={float(r['cantidad'] or 0):.2f} "
            f"lineas={int(r['lineas'] or 0)}"
        )

    if not args.apply:
        print("No se aplicaron cambios. Repite con --apply para actualizar TINV_EPRODUCTO.")
        return 0

    with client.cursor() as cur:
        for r in rows:
            cur.execute(
                "UPDATE INV.TINV_EPRODUCTO "
                "SET exist_actual = NVL(exist_actual, 0) - :1 "
                "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                [
                    float(r["cantidad"] or 0),
                    r["no_cia"],
                    r["punto"],
                    r["almacen"],
                    r["no_produ"],
                ],
            )
            if cur.rowcount == 0:
                raise RuntimeError(
                    "No existe TINV_EPRODUCTO para "
                    f"{r['no_cia']}/{r['punto']}/{r['almacen']}/{r['no_produ']}"
                )
        cur.connection.commit()
    print("Backfill aplicado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
