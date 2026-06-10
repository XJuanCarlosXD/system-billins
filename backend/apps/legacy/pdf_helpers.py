"""Helpers de generación de PDF compartidos entre módulos legacy (INV, FAT).

`build_pdf_report` es la función central. Recibe título, columnas, filas y
genera un PDF tabular usando reportlab. Soporta opcionalmente `header_extra`
y `footer_extra` (lista de strings con HTML-like markup de reportlab) para
documentos con encabezado/pie (ej. facturas FAT) además de listados (INV).
"""
from __future__ import annotations

import io

from .logo_helpers import get_logo_path


def _logo_flowable(no_cia: str | None, width: float, height: float):
    """Devuelve un Image flowable para el logo de la empresa, o None si no hay.

    `width` / `height` son el tamaño máximo (kind='proportional' respeta el aspect ratio).
    """
    if not no_cia:
        return None
    path = get_logo_path(no_cia)
    if not path:
        return None
    try:
        from reportlab.platypus import Image
        return Image(str(path), width=width, height=height, kind='proportional')
    except Exception:
        return None


def build_pdf_report(
    title: str,
    columns: list[str],
    rows: list[dict],
    col_widths: list | None = None,
    *,
    header_extra: list[str] | None = None,
    footer_extra: list[str] | None = None,
    page_size=None,
    max_rows: int = 10000,
    no_cia: str | None = None,
) -> bytes:
    """Construye un PDF simple con título + tabla.

    - `header_extra`: párrafos a insertar antes de la tabla (formato reportlab
      Paragraph, acepta tags `<b>`, `<i>`, `<br/>`).
    - `footer_extra`: párrafos a insertar después de la tabla y del "Total
      registros" (o en su lugar si rows está vacío).
    - `page_size`: por defecto `landscape(letter)` (listados). Para documentos
      portrait (facturas) pasar `letter`.
    - `no_cia`: si se pasa y la empresa tiene logo subido (POST /api/cnt/cia-header/),
      se inserta el logo a la izquierda del titulo.
    """
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch

    if page_size is None:
        page_size = landscape(letter)

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buffer, pagesize=page_size,
                                leftMargin=0.5*inch, rightMargin=0.5*inch,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements: list = []

    # Logo + titulo en una fila si hay logo, sino titulo solo.
    logo = _logo_flowable(no_cia, width=1.0*inch, height=0.6*inch)
    if logo is not None:
        # Tabla 2 cols sin bordes: logo a la izquierda, titulo a la derecha.
        title_para = Paragraph(title, styles['Title'])
        title_table = Table(
            [[logo, title_para]],
            colWidths=[1.1*inch, None],
        )
        title_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(title_table)
    else:
        elements.append(Paragraph(title, styles['Title']))
    elements.append(Spacer(1, 8))

    if header_extra:
        for line in header_extra:
            elements.append(Paragraph(line, styles['Normal']))
        elements.append(Spacer(1, 8))

    if rows:
        header_row = [c.upper() for c in columns]
        data = [header_row]
        for r in rows[:max_rows]:
            row_data = []
            for c in columns:
                val = r.get(c.lower(), r.get(c.upper(), ''))
                if isinstance(val, float):
                    val = f"{val:,.2f}"
                row_data.append(str(val or ''))
            data.append(row_data)

        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#DCE6F1')]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Total registros: {len(rows)}", styles['Normal']))
    else:
        elements.append(Paragraph("Sin datos.", styles['Normal']))

    if footer_extra:
        elements.append(Spacer(1, 8))
        for line in footer_extra:
            elements.append(Paragraph(line, styles['Normal']))

    doc_pdf.build(elements)
    buffer.seek(0)
    return buffer.read()
