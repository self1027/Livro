const PDFDocument = require('pdfkit')
const DENUNCIATION_STATUS = require('../../constants/denunciationStatus')

function generateDenunciasPdf(res, { fiscal, denuncias, status }) {

    const doc = new PDFDocument({ margin: 50 })
    doc.pipe(res)

    const statusLabel =
        status !== 'ALL'
            ? DENUNCIATION_STATUS[status]?.label
            : 'Todas'

    doc.fontSize(18).text(
        `Denúncias ${statusLabel} - Fiscal ${fiscal.name}`,
        { align: 'center' }
    )

    doc.moveDown()

    denuncias.forEach(d => {

        doc.fontSize(12).text(
            `Denúncia #${d.number}/${d.year} - ${d.title}`,
            { align: 'center' }
        )

        doc.text(
            `Endereço: ${d.endereco}, Nº ${d.numero} - Bairro ${d.bairro}`,
            { align: 'center' }
        )

        if (d.complemento) {
            doc.text(`Complemento: ${d.complemento}`, {
                align: 'center'
            })
        }

        doc.moveDown(1)

        doc.text(`Descrição: ${d.description}`, {
            align: 'justify'
        })

        doc.moveDown(0.5)

        doc.moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .stroke()

        doc.moveDown(1)
    })

    doc.end()
}

module.exports = {
    generateDenunciasPdf
}