import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({
  value,
  size = 200,
  margin = 1,
}: {
  value: string;
  size?: number;
  margin?: number;
}) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: "svg",
      margin,
      width: size,
      color: { dark: "#080a0e", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((result) => {
        if (!cancelled) setSvg(result);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, margin]);

  if (!svg) return null;

  return (
    <div
      className="qr-code"
      style={{ width: size, height: size }}
      aria-label="QR code"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
