const express = require("express");
const app = express();
const port = 3000;
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const archiver = require("archiver");
const { Worker } = require("worker_threads");

app.use(express.json());

function generateQRCode(data) {
  return QRCode.toDataURL(data);
}

async function createPDF(customerName, deliveryLocation, materialCode, currentCase, totalCases) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [283.465, 212.6],
      margins: { bottom: 2, top: 2, right: 2, left: 2 },
    });
    
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc
      .fontSize(7.8)
      .rect(10, 10, 263.4, 202.6)
      .stroke()
      .rect(12, 12, 259.4, 198.6)
      .stroke();
    
    doc.image("./logo.png", 40, 15, {
      width: 200,
      height: 50,
      align: "center",
      valign: "center",
    });

    doc
      .moveTo(15, doc.y + 75)
      .lineTo(268, doc.y + 75)
      .stroke();

    doc
      .text("Recipient:", 30, 110)
      .text(customerName)
      .text(deliveryLocation, { width: 100 })
      .text(`Material Code: ${materialCode}`, 30, 175)
      .text(`Cases: ${currentCase}/${totalCases}`);

    generateQRCode(JSON.stringify({ customerName, deliveryLocation, materialCode, currentCase, totalCases }))
      .then((qrCodeData) => {
        const qrCodeBuffer = Buffer.from(qrCodeData.split(",")[1], "base64");
        doc.image(qrCodeBuffer, doc.x + 130, 100, {
          fit: [100, 100],
          align: "center",
          valign: "center",
        });
        doc.end();
      })
      .catch(reject);
  });
}

app.post("/generate-label", async (req, res) => {
  const { customerName, deliveryLocation, materialCode, numberOfCases } = req.body;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=labels.zip");
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  try {
    const pdfPromises = [];
    for (let i = 0; i < numberOfCases; i++) {
      pdfPromises.push(createPDF(customerName, deliveryLocation, materialCode, i + 1, numberOfCases));
    }

    const pdfBuffers = await Promise.all(pdfPromises);

    pdfBuffers.forEach((buffer, index) => {
      archive.append(buffer, { name: `label_${index + 1}.pdf` });
    });

    archive.finalize();
  } catch (error) {
    res.status(500).send({ error: "An error occurred while generating labels" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
