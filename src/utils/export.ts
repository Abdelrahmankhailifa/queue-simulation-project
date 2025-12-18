import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportToPdf(filename: string, title: string, headers: string[], body: any[][], summary?: Record<string, string | number>) {
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text(title, 14, 22)

    // Simulation Table
    autoTable(doc, {
        head: [headers],
        body: body,
        startY: 30,
        theme: 'striped',
        headStyles: { fillColor: [67, 56, 202] }, // Indigo 700
        styles: { fontSize: 8 },
    })

    // Summary Information
    if (summary) {
        const finalY = (doc as any).lastAutoTable.finalY || 30
        doc.setFontSize(14)
        doc.text('Performance Analysis', 14, finalY + 15)

        doc.setFontSize(10)
        let yOffset = finalY + 25
        Object.entries(summary).forEach(([key, value]) => {
            doc.text(`${key}: ${value}`, 14, yOffset)
            yOffset += 7
        })
    }

    doc.save(`${filename}.pdf`)
}
