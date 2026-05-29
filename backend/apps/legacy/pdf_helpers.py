"""Helpers de generación de PDF compartidos entre módulos legacy (INV, FAT).

`build_pdf_report` es la función central. Recibe título, columnas, filas y
genera un PDF tabular usando reportlab. Soporta opcionalmente `header_extra`
y `footer_extra` (lista de strings con HTML-like markup de reportlab) para
documentos con encabezado/pie (ej. facturas FAT) además de listados (INV).
"""
from __future__ import annotations

import io


def build_pdf_report(
    title: str,
    columns: list[str],
    rows: list[dict],
    col_widths: list | None = None,
    *,
    header_extra: list[str] | None = None,
    footer_extra: list[str] | None = None,
    page_size=None,
) -> bytes:
    """Construye un PDF simple con título + tabla.

    - `header_extra`: párrafos a insertar antes de la tabla (formato reportlab
      Paragraph, acepta tags `<b>`, `<i>`, `<br/>`).
    - `footer_extra`: párrafos a insertar después de la tabla y del "Total
      registros" (o en su lugar si rows está vacío).
    - `page_size`: por defecto `landscape(letter)` (listados). Para documentos
      portrait (facturas) pasar `letter`.
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
    elements = [Paragraph(title, styles['Title']), Spacer(1, 8)]

    if header_extra:
        for line in header_extra:
            elements.append(Paragraph(line, styles['Normal']))
        elements.append(Spacer(1, 8))

    if rows:
        header_row = [c.upper() for c in columns]
        data = [header_row]
        for r in rows[:500]:
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
