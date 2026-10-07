import QRCode from "qrcode";

/** 1024 px: resolución suficiente para flyers, packaging y vinilos de vitrina. */
const QR_PNG_WIDTH = 1024;

/** Descarga el QR de `url` como PNG (`<fileBase>-qr.png`). */
export async function downloadQrPng(url: string, fileBase: string): Promise<void> {
  const data = await QRCode.toDataURL(url, {
    margin: 2,
    width: QR_PNG_WIDTH,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
  const a = document.createElement("a");
  a.href = data;
  a.download = `${fileBase}-qr.png`;
  a.click();
}
