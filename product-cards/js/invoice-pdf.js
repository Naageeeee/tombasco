import { PDFDocument, PageSizes, StandardFonts, rgb } from './vendor/pdf-lib.esm.min.js';

const ink = rgb(18 / 255, 38 / 255, 58 / 255);
const blue = rgb(31 / 255, 111 / 255, 178 / 255);
const red = rgb(179 / 255, 38 / 255, 30 / 255);
const muted = rgb(85 / 255, 96 / 255, 107 / 255);
const line = rgb(219 / 255, 227 / 255, 234 / 255);
const tint = rgb(239 / 255, 247 / 255, 250 / 255);
const stripe = rgb(248 / 255, 251 / 255, 252 / 255);
const agentBlue = rgb(52 / 255, 65 / 255, 143 / 255);
const white = rgb(1, 1, 1);

function alignedX(anchor, width, align) {
  if (align === 'right') return anchor - width;
  if (align === 'center') return anchor - width / 2;
  return anchor;
}

async function embedInterplastLogo(pdf) {
  try {
    const logo = new Image();
    logo.src = new URL('../../assets/images/interplast-logo.webp', import.meta.url).href;
    await logo.decode();

    const canvas = document.createElement('canvas');
    canvas.width = logo.naturalWidth;
    canvas.height = logo.naturalHeight;
    canvas.getContext('2d').drawImage(logo, 0, 0);
    return await pdf.embedPng(canvas.toDataURL('image/png'));
  } catch {
    // The invoice remains downloadable if the storefront logo is unavailable.
    return null;
  }
}

function wrapText(text, maxWidth, measure) {
  const words = String(text).trim().split(/\s+/u);
  const lines = [];
  let current = '';

  for (const word of words) {
    const combined = current ? `${current} ${word}` : word;
    if (measure(combined) <= maxWidth) {
      current = combined;
      continue;
    }

    if (current) lines.push(current);
    current = '';

    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }

    for (const character of word) {
      if (current && measure(current + character) > maxWidth) {
        lines.push(current);
        current = '';
      }
      current += character;
    }
  }

  if (current || !lines.length) lines.push(current);
  return lines;
}

function createInvoiceText(pdf, font, size) {
  const repertoire = new Set(font.getCharacterSet());
  let canvas;
  let cediGlyph;

  function canEncode(text) {
    return Array.from(text).every(character => repertoire.has(character.codePointAt(0)));
  }

  function getContext() {
    canvas ??= document.createElement('canvas');
    const context = canvas.getContext('2d');
    const weight = font.name === StandardFonts.HelveticaBold ? 'bold' : 'normal';
    context.font = `${weight} ${size}px Arial, sans-serif`;
    context.textBaseline = 'alphabetic';
    return context;
  }

  function measurePart(text) {
    return canEncode(text) ? font.widthOfTextAtSize(text, size) : getContext().measureText(text).width;
  }

  function parts(text) {
    // Draw the cedi glyph separately so the numbers in each amount stay selectable.
    return text.startsWith('GH₵') ? ['GH', '₵', text.slice('GH₵'.length)] : [text];
  }

  function measure(text) {
    return parts(text).reduce((width, part) => width + measurePart(part), 0);
  }

  async function rasterize(text) {
    // A local canvas preserves any characters outside the standard PDF font's repertoire.
    const metrics = getContext().measureText(text);
    const scale = 3;
    const pad = 2;
    const leftOverhang = Math.max(0, metrics.actualBoundingBoxLeft);
    const rightEdge = Math.max(metrics.width, metrics.actualBoundingBoxRight);
    const baseline = Math.max(size, metrics.actualBoundingBoxAscent) + pad;
    canvas.width = Math.ceil((leftOverhang + rightEdge + pad * 2) * scale);
    canvas.height = Math.ceil((baseline + Math.max(size * 0.35, metrics.actualBoundingBoxDescent) + pad) * scale);

    const context = getContext();
    context.scale(scale, scale);
    context.fillStyle = '#12263a';
    context.fillText(text, leftOverhang + pad, baseline);

    const image = await pdf.embedPng(canvas.toDataURL('image/png'));
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    return { image, width, height, xOffset: -leftOverhang - pad, yOffset: baseline - height };
  }

  async function draw(page, text, anchor, y, align = 'left') {
    let x = alignedX(anchor, measure(text), align);
    for (const part of parts(text)) {
      if (!part) continue;
      if (canEncode(part)) {
        page.drawText(part, { x, y, size, font, color: ink });
      } else {
        const glyph = part === '₵' ? (cediGlyph ??= await rasterize(part)) : await rasterize(part);
        page.drawImage(glyph.image, {
          x: x + glyph.xOffset, y: y + glyph.yOffset, width: glyph.width, height: glyph.height
        });
      }
      x += measurePart(part);
    }
  }

  return { measure, draw };
}

export async function createInvoicePdf({ orderId, received, fulfilment, transactionId, items, subtotal }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const interplastLogo = await embedInterplastLogo(pdf);
  const logoSize = interplastLogo?.scaleToFit(64, 30);
  pdf.setTitle(`Invoice ${orderId}`);
  pdf.setAuthor('Tom Basco Enterprise');

  const [pageWidth, pageHeight] = PageSizes.A4;
  const left = 44;
  const right = pageWidth - left;
  const contentWidth = right - left;
  const bottom = 58;
  const textSize = 11;
  const lineHeight = 15;
  const rowPadding = 8;
  const tableHeaderHeight = 28;
  const text = createInvoiceText(pdf, regular, textSize);
  const totalText = createInvoiceText(pdf, bold, 14);
  const totals = wrapText(subtotal, 200, totalText.measure);
  const totalHeight = 24 + totals.length * lineHeight;
  const totalGap = 16;
  const totalSpace = totalGap + totalHeight + 23;
  const columns = [
    { anchor: left + 8, width: right - left - 192 },
    { anchor: right - 156, width: 60, align: 'center' },
    { anchor: right - 8, width: 108, align: 'right' }
  ];

  let page;
  let cursor;
  let hasRows;

  function drawLabel(value, x, y, size = textSize, font = regular, color = ink) {
    page.drawText(value, { x, y, size, font, color });
  }

  function drawRule(y) {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: line });
  }

  async function drawDetails() {
    const details = [
      ['Received', received || 'Unavailable'],
      ['Fulfilment', fulfilment],
      ['Payment ID', String(transactionId ?? '').trim() || 'Unavailable']
    ];
    const columnWidth = contentWidth / details.length;
    const values = details.map(([, value]) => wrapText(value, columnWidth - 28, text.measure));
    const numberOfLines = Math.max(...values.map(value => value.length));
    const firstLineHeight = 62;
    const gap = 24;
    const reserved = firstLineHeight + gap + tableHeaderHeight + rowPadding * 2;

    for (let offset = 0; offset < numberOfLines;) {
      const remainingRoom = Math.floor((cursor - bottom - reserved) / lineHeight);
      const count = Math.min(remainingRoom, numberOfLines - offset);
      const height = firstLineHeight + (count - 1) * lineHeight;
      page.drawRectangle({ x: left, y: cursor - height, width: contentWidth, height, color: stripe });

      for (const [index, [label]] of details.entries()) {
        const visible = values[index].slice(offset, offset + count);
        if (!visible.length) continue;

        const x = left + 14 + columnWidth * index;
        drawLabel(label, x, cursor - 20, 10, bold, muted);
        for (const [row, value] of visible.entries()) {
          await text.draw(page, value, x, cursor - 40 - row * lineHeight);
        }
      }

      cursor -= height + gap;
      offset += count;
      if (offset < numberOfLines) startPage();
    }
  }

  function startPage() {
    const firstPage = pdf.getPageCount() === 0;
    page = pdf.addPage(PageSizes.A4);
    hasRows = false;
    const top = pageHeight - (firstPage ? 50 : 44);
    drawLabel('Tom Basco Enterprise', left, top - 15, 14, bold, red);
    if (logoSize) {
      page.drawImage(interplastLogo, { x: left, y: top - 49, ...logoSize });
      drawLabel('agent', left + logoSize.width + 5, top - 40, 11, bold, agentBlue);
    } else {
      drawLabel('Interplast agent', left, top - 40, 11, bold, agentBlue);
    }
    drawLabel('Invoice', left, top - (firstPage ? 100 : 94), firstPage ? 34 : 26, bold);

    const referenceX = right - 138;
    page.drawRectangle({ x: referenceX, y: top - 69, width: 138, height: 54, color: tint });
    drawLabel('Order number', referenceX + 14, top - 36, 10, bold, muted);
    drawLabel(orderId, referenceX + 14, top - 56, 16, bold, blue);

    cursor = top - (firstPage ? 129 : 116);
  }

  function drawTableHeader() {
    page.drawRectangle({ x: left, y: cursor - tableHeaderHeight, width: contentWidth, height: tableHeaderHeight, color: blue });
    drawLabel('Item', columns[0].anchor, cursor - 18, textSize, bold, white);
    for (const [index, label] of ['Quantity', 'Amount'].entries()) {
      const { anchor, align } = columns[index + 1];
      const x = alignedX(anchor, bold.widthOfTextAtSize(label, textSize), align);
      drawLabel(label, x, cursor - 18, textSize, bold, white);
    }
    cursor -= tableHeaderHeight;
  }

  function startTablePage() {
    startPage();
    drawTableHeader();
  }

  startPage();
  await drawDetails();
  drawTableHeader();
  for (const [index, item] of items.entries()) {
    const cells = [item.description, item.quantity, item.amount]
      .map((value, index) => wrapText(value, columns[index].width, text.measure));
    const lineCount = Math.max(...cells.map(cell => cell.length));
    const visibleLines = () => Math.floor((cursor - bottom - rowPadding * 2) / lineHeight);
    const spaceAfterItem = index === items.length - 1 ? totalSpace : 0;
    const itemHeight = rowPadding * 2 + lineCount * lineHeight;

    if (hasRows && cursor - itemHeight - spaceAfterItem < bottom) startTablePage();

    for (let offset = 0; offset < lineCount;) {
      const count = Math.min(visibleLines(), lineCount - offset);
      const rowHeight = rowPadding * 2 + count * lineHeight;
      if (index % 2 === 1) {
        page.drawRectangle({ x: left, y: cursor - rowHeight, width: contentWidth, height: rowHeight, color: stripe });
      }
      for (const [index, cell] of cells.entries()) {
        const { anchor, align } = columns[index];
        const visible = cell.slice(offset, offset + count);
        for (const [row, value] of visible.entries()) {
          await text.draw(page, value, anchor, cursor - rowPadding - 11 - row * lineHeight, align);
        }
      }

      cursor -= rowHeight;
      drawRule(cursor);
      hasRows = true;
      offset += count;
      if (offset < lineCount) startTablePage();
    }
  }

  if (cursor - totalSpace < bottom) startPage();
  const totalTop = cursor - totalGap;
  page.drawRectangle({ x: left, y: totalTop - totalHeight, width: contentWidth, height: totalHeight, color: tint });
  drawLabel('Items subtotal', left + 12, totalTop - 24, 12, bold);
  for (const [row, amount] of totals.entries()) {
    await totalText.draw(page, amount, columns[2].anchor, totalTop - 24 - row * lineHeight, 'right');
  }
  drawLabel('Keep your order number for pickup or delivery enquiries.', left, cursor - totalSpace, 10, regular, muted);

  const pages = pdf.getPages();
  for (const [index, sheet] of pages.entries()) {
    const number = `Page ${index + 1} of ${pages.length}`;
    sheet.drawLine({ start: { x: left, y: 47 }, end: { x: right, y: 47 }, thickness: 0.6, color: line });
    sheet.drawText(number, { x: right - regular.widthOfTextAtSize(number, 9), y: 31, size: 9, font: regular, color: muted });
  }

  return pdf.save();
}
