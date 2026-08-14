import { toPng } from "html-to-image";

/**
 * Exports an HTML element as a high-resolution PNG file download.
 */
export async function exportCardAsPng(
  element: HTMLElement,
  filename: string = "third-umpire-stat-card.png"
): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2.5, // Crisp high-DPI rendering
      cacheBust: true,
      style: {
        borderRadius: "16px",
      },
    });

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Failed to export stat card as PNG:", error);
  }
}
