import { jsPDF } from 'jspdf';
import type { Recipe } from '../types';

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 portrait, mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MAX_IMAGE_HEIGHT = 80; // mm — image is scaled down to fit, keeping its aspect ratio

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

/** Reads the natural pixel dimensions of a data URL image. */
const getImageSize = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });

export interface RecipePdfOptions {
  /** Whether to embed the recipe's photo. Defaults to true. */
  includeImage?: boolean;
}

/** Draws a single printable recipe card into an existing jsPDF document, starting at the top of the current page. */
async function addRecipeToDoc(doc: jsPDF, recipe: Recipe, options: RecipePdfOptions = {}): Promise<void> {
  const { includeImage = true } = options;
  let y = MARGIN;

  // Image (if available and requested) — scaled to fit while keeping its aspect ratio
  if (includeImage && recipe.imageUrl) {
    try {
      const dataUrl = await toDataUrl(recipe.imageUrl);
      const { width, height } = await getImageSize(dataUrl);
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const scale = Math.min(CONTENT_WIDTH / width, MAX_IMAGE_HEIGHT / height);
      const drawWidth = width * scale;
      const drawHeight = height * scale;
      const x = MARGIN + (CONTENT_WIDTH - drawWidth) / 2;
      doc.addImage(dataUrl, format, x, y, drawWidth, drawHeight, undefined, 'FAST');
      y += drawHeight + 8;
    } catch {
      // Ignore image failures — continue with a text-only card.
    }
  }

  // Everything below is plain black text / lines — printer-friendly by design.
  doc.setTextColor(0);

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

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
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
}

/** Builds a printable, color A4 recipe card PDF and returns it as an object URL. */
export async function buildRecipePdf(recipe: Recipe, options: RecipePdfOptions = {}): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await addRecipeToDoc(doc, recipe, options);
  return doc.output('bloburl').toString();
}

/**
 * Builds one combined, printer-friendly A4 PDF containing every given recipe,
 * each starting on its own page, and triggers a browser download.
 */
export async function buildRecipesPdf(
  recipes: Recipe[],
  options: RecipePdfOptions = {},
  filename = 'rezepte.pdf',
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  for (let i = 0; i < recipes.length; i++) {
    if (i > 0) doc.addPage();
    await addRecipeToDoc(doc, recipes[i], options);
  }
  doc.save(filename);
}
