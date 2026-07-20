import { jsPDF } from 'jspdf';
import type { Recipe } from '../types';

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 portrait, mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Loads an image URL into a data URL so jsPDF can embed it. */
const toDataUrl = (url: string): Promise<string> =>
  fetch(url)
    .then(res => res.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );

/** Builds a printable A4 recipe card PDF and returns it as an object URL. */
export async function buildRecipePdf(recipe: Recipe): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  // Image (if available)
  if (recipe.imageUrl) {
    try {
      const dataUrl = await toDataUrl(recipe.imageUrl);
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const imgHeight = 60;
      doc.addImage(dataUrl, format, MARGIN, y, CONTENT_WIDTH, imgHeight, undefined, 'FAST');
      y += imgHeight + 8;
    } catch {
      // Ignore image failures — continue with a text-only card.
    }
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(recipe.name, CONTENT_WIDTH);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 9 + 2;

  // Description
  if (recipe.description) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(90);
    const descLines = doc.splitTextToSize(recipe.description, CONTENT_WIDTH);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 5 + 6;
    doc.setTextColor(0);
  }

  doc.setDrawColor(232, 68, 10);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > 297 - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Ingredients
  if (recipe.ingredients.length) {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Zutaten', MARGIN, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (const ing of recipe.ingredients) {
      const qty = [ing.quantity, ing.unit].filter(Boolean).join(' ').trim();
      const line = qty ? `${qty}  ${ing.name}` : ing.name;
      const lines = doc.splitTextToSize(`•  ${line}`, CONTENT_WIDTH);
      ensureSpace(lines.length * 5.5 + 1);
      doc.text(lines, MARGIN, y);
      y += lines.length * 5.5 + 1;
    }
    y += 5;
  }

  // Steps
  if (recipe.steps.length) {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Zubereitung', MARGIN, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    recipe.steps.forEach((step, idx) => {
      const prefix = `${idx + 1}. `;
      const lines = doc.splitTextToSize(`${prefix}${step.instruction}`, CONTENT_WIDTH);
      ensureSpace(lines.length * 5.5 + 2);
      doc.text(lines, MARGIN, y);
      y += lines.length * 5.5 + 2;
    });
  }

  return doc.output('bloburl').toString();
}
