import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableW = pageW - margin * 2;
  const ratio = canvas.height / canvas.width;
  const imgW = usableW;
  const imgH = imgW * ratio;

  if (imgH <= pageH - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
  } else {
    // Slice into multiple pages
    const pageCanvasH = (canvas.width * (pageH - margin * 2)) / usableW;
    let rendered = 0;
    let pageIndex = 0;
    while (rendered < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - rendered);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const slice = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(slice, "JPEG", margin, margin, imgW, (sliceH * imgW) / canvas.width);
      rendered += sliceH;
      pageIndex++;
    }
  }

  pdf.save(filename);
}
