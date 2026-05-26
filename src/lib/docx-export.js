import { riskLabel, statusLabel, suitabilityLabel } from "../domain/validation.js";

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ODT_MIME_TYPE = "application/vnd.oasis.opendocument.text";

export function buildInitiativeDocxBlob(initiative, user, options = {}) {
  return new Blob([buildInitiativeDocxPackage(initiative, user, options)], { type: DOCX_MIME_TYPE });
}

export function buildInitiativeDocxPackage(initiative, user, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const modifiedAt = new Date(options.modifiedAt || generatedAt);
  const files = [
    { path: "[Content_Types].xml", content: docxContentTypesXml() },
    { path: "_rels/.rels", content: docxPackageRelationshipsXml() },
    { path: "docProps/core.xml", content: docxCorePropertiesXml(initiative, user, generatedAt) },
    { path: "docProps/app.xml", content: docxAppPropertiesXml() },
    { path: "word/_rels/document.xml.rels", content: docxDocumentRelationshipsXml() },
    { path: "word/styles.xml", content: docxStylesXml() },
    { path: "word/document.xml", content: initiativeDocxDocumentXml(initiative, user, generatedAt) }
  ];

  return createZipArchive(files, Number.isNaN(modifiedAt.getTime()) ? new Date() : modifiedAt);
}

export function initiativeDocxFileName(initiative) {
  return `${initiativeExportBaseName(initiative)}.docx`;
}

export function buildInitiativeOdtBlob(initiative, user, options = {}) {
  return new Blob([buildInitiativeOdtPackage(initiative, user, options)], { type: ODT_MIME_TYPE });
}

export function buildInitiativeOdtPackage(initiative, user, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const modifiedAt = new Date(options.modifiedAt || generatedAt);
  const files = [
    { path: "mimetype", content: ODT_MIME_TYPE },
    { path: "META-INF/manifest.xml", content: odtManifestXml() },
    { path: "content.xml", content: initiativeOdtContentXml(initiative, user, generatedAt) },
    { path: "styles.xml", content: odtStylesXml() },
    { path: "meta.xml", content: odtMetaXml(initiative, user, generatedAt) }
  ];

  return createZipArchive(files, Number.isNaN(modifiedAt.getTime()) ? new Date() : modifiedAt);
}

export function initiativeOdtFileName(initiative) {
  return `${initiativeExportBaseName(initiative)}.odt`;
}

function initiativeDocxDocumentXml(initiative, user, generatedAt) {
  const review = initiative.aiReview || { score: 0, risk: "low", findings: [], checks: {} };
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const content = [
    docxParagraph("Demokracija 2.0", {
      bold: true,
      color: "0F766E",
      size: 18,
      spacingAfter: 40
    }),
    docxParagraph("Izvoz zakonodajne pobude za DZ", {
      bold: true,
      size: 32,
      spacingAfter: 80
    }),
    docxParagraph(`Izvoz ustvarjen: ${formatDate(generatedAt)}`, {
      color: "4B5563",
      size: 19,
      bottomBorder: "0F766E",
      bottomBorderSize: 12,
      spacingAfter: 260
    }),

    docxHeading("Identifikacija pobude"),
    docxKeyValueTable([
      ["ID pobude", initiative.id],
      ["Naslov", initiative.title],
      ["Kategorija", initiative.category],
      ["Status", statusLabel(initiative.status)],
      ["Avtor", `${initiative.author?.name || ""} (${initiative.author?.id || ""})`],
      ["Ustvarjeno", formatDate(initiative.createdAt)],
      ["Zadnja posodobitev", formatDate(initiative.updatedAt)]
    ]),

    docxHeading("Kratek povzetek"),
    docxParagraph(initiative.summary, {
      shading: "ECFDF5",
      boxBorder: "99F6E4",
      spacingAfter: 200
    }),

    docxHeading("Obrazlozitev"),
    docxTextBlock(initiative.description),

    docxHeading("Pravna podlaga in pricakovani ucinek"),
    docxKeyValueTable([
      ["Pravna podlaga", initiative.legalReference || "Ni navedena."],
      ["Pricakovani ucinek", initiative.expectedImpact || "Ni naveden."]
    ]),

    docxHeading("Podpora in evidenca"),
    docxKeyValueTable([
      ["Glasovi", String(initiative.votes?.length || 0)],
      ["Podpisi", String(initiative.signatures?.length || 0)],
      ["Komentarji", String(initiative.comments?.length || 0)],
      ["AI ocena", `${review.score || 0}% - ${riskLabel(review.risk)}`]
    ]),
    initiativeSignaturesDocxTable(initiative.signatures || []),

    docxHeading("AI predpregled"),
    docxKeyValueTable([
      ["Ustreznost", suitabilityLabel(review.checks?.suitability || "insufficient")],
      ["Popolnost", `${review.checks?.completeness?.score ?? 0}%`],
      ["Predlagana kategorija", review.checks?.categorySuggestion?.category || "Ni predloga"]
    ]),
    findings.length
      ? findings.map((finding) => docxParagraph(`- ${finding}`, { spacingAfter: 80 })).join("")
      : docxParagraph("Ni ugotovitev.", { color: "4B5563", size: 19, spacingAfter: 140 }),

    docxHeading("Potrditev priprave"),
    docxKeyValueTable([
      ["Izvoz pripravil", user?.name || user?.id || "Uporabnik"],
      ["Namen izvoza", "Oddaja zakonodajne pobude v nadaljnji postopek."]
    ]),
    docxParagraph("____________________________", { spacingBefore: 340, spacingAfter: 20 }),
    docxParagraph("Podpis odgovorne osebe", { size: 19, spacingAfter: 260 }),
    docxParagraph(
      "Dokument je ustvarjen iz podatkov aplikacije Demokracija 2.0. Za uradno oddajo preverite aktualna pravila in zahtevane priloge Drzavnega zbora.",
      {
        topBorder: "D1D5DB",
        color: "4B5563",
        size: 18,
        spacingBefore: 80,
        spacingAfter: 0
      }
    )
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1021" w:right="1021" w:bottom="1021" w:left="1021" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function initiativeOdtContentXml(initiative, user, generatedAt) {
  const review = initiative.aiReview || { score: 0, risk: "low", findings: [], checks: {} };
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const content = [
    odtParagraph("Demokracija 2.0", "DemosBrand"),
    odtParagraph("Izvoz zakonodajne pobude za DZ", "DemosTitle"),
    odtParagraph(`Izvoz ustvarjen: ${formatDate(generatedAt)}`, "DemosMuted"),

    odtHeading("Identifikacija pobude"),
    odtKeyValueTable([
      ["ID pobude", initiative.id],
      ["Naslov", initiative.title],
      ["Kategorija", initiative.category],
      ["Status", statusLabel(initiative.status)],
      ["Avtor", `${initiative.author?.name || ""} (${initiative.author?.id || ""})`],
      ["Ustvarjeno", formatDate(initiative.createdAt)],
      ["Zadnja posodobitev", formatDate(initiative.updatedAt)]
    ]),

    odtHeading("Kratek povzetek"),
    odtParagraph(initiative.summary, "DemosSummary"),

    odtHeading("Obrazlozitev"),
    odtTextBlock(initiative.description),

    odtHeading("Pravna podlaga in pricakovani ucinek"),
    odtKeyValueTable([
      ["Pravna podlaga", initiative.legalReference || "Ni navedena."],
      ["Pricakovani ucinek", initiative.expectedImpact || "Ni naveden."]
    ]),

    odtHeading("Podpora in evidenca"),
    odtKeyValueTable([
      ["Glasovi", String(initiative.votes?.length || 0)],
      ["Podpisi", String(initiative.signatures?.length || 0)],
      ["Komentarji", String(initiative.comments?.length || 0)],
      ["AI ocena", `${review.score || 0}% - ${riskLabel(review.risk)}`]
    ]),
    initiativeSignaturesOdtTable(initiative.signatures || []),

    odtHeading("AI predpregled"),
    odtKeyValueTable([
      ["Ustreznost", suitabilityLabel(review.checks?.suitability || "insufficient")],
      ["Popolnost", `${review.checks?.completeness?.score ?? 0}%`],
      ["Predlagana kategorija", review.checks?.categorySuggestion?.category || "Ni predloga"]
    ]),
    findings.length
      ? findings.map((finding) => odtParagraph(`- ${finding}`, "DemosBody")).join("")
      : odtParagraph("Ni ugotovitev.", "DemosMuted"),

    odtHeading("Potrditev priprave"),
    odtKeyValueTable([
      ["Izvoz pripravil", user?.name || user?.id || "Uporabnik"],
      ["Namen izvoza", "Oddaja zakonodajne pobude v nadaljnji postopek."]
    ]),
    odtParagraph("____________________________", "DemosSignatureLine"),
    odtParagraph("Podpis odgovorne osebe", "DemosMuted"),
    odtParagraph(
      "Dokument je ustvarjen iz podatkov aplikacije Demokracija 2.0. Za uradno oddajo preverite aktualna pravila in zahtevane priloge Drzavnega zbora.",
      "DemosFooter"
    )
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3">
  <office:automatic-styles>
    ${odtAutomaticStylesXml()}
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${content}
    </office:text>
  </office:body>
</office:document-content>`;
}

function initiativeSignaturesOdtTable(signatures) {
  if (!signatures.length) {
    return odtParagraph("Podpisi niso evidentirani.", "DemosMuted");
  }

  const rows = [
    [
      { text: "Podpisnik", bold: true },
      { text: "Identifikator", bold: true },
      { text: "Metoda", bold: true },
      { text: "Datum", bold: true }
    ],
    ...signatures.map((signature) => [
      signature.userName,
      signature.userId,
      signature.method || "demo",
      formatDate(signature.createdAt)
    ])
  ];

  return odtTable(rows, "Podpisi");
}

function odtHeading(text) {
  return `<text:h text:style-name="DemosHeading" text:outline-level="1">${odtInlineText(text)}</text:h>`;
}

function odtTextBlock(value) {
  const paragraphs = String(value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (paragraphs.length ? paragraphs : [""]).map((paragraph) => odtParagraph(paragraph, "DemosBody")).join("");
}

function odtKeyValueTable(rows) {
  return odtTable(
    rows.map(([label, value]) => [
      { text: label, bold: true },
      { text: value }
    ]),
    "Podatki"
  );
}

function odtTable(rows, name) {
  return `
    <table:table table:name="${escapeXml(name)}" table:style-name="DemosTable">
      ${rows.map((row) => `<table:table-row>${row.map(odtTableCell).join("")}</table:table-row>`).join("")}
    </table:table>
    ${odtParagraph("", "DemosSpacer")}
  `;
}

function odtTableCell(cell) {
  const normalized = typeof cell === "object" && cell ? cell : { text: cell };
  const styleName = normalized.bold ? "DemosHeaderCell" : "DemosTableCell";
  const content = normalized.bold
    ? `<text:span text:style-name="DemosBold">${odtInlineText(normalized.text)}</text:span>`
    : odtInlineText(normalized.text);

  return `
    <table:table-cell table:style-name="${styleName}" office:value-type="string">
      <text:p text:style-name="DemosTableText">${content}</text:p>
    </table:table-cell>
  `;
}

function odtParagraph(text, styleName = "DemosBody") {
  return `<text:p text:style-name="${styleName}">${odtInlineText(text)}</text:p>`;
}

function odtInlineText(value) {
  return String(value ?? "")
    .split("\n")
    .map((part, index) => `${index === 0 ? "" : "<text:line-break/>"}${escapeXml(part)}`)
    .join("");
}

function odtAutomaticStylesXml() {
  return `
    <style:style style:name="DemosTable" style:family="table">
      <style:table-properties table:align="margins"/>
    </style:style>
    <style:style style:name="DemosHeaderCell" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#F3F4F6" fo:border="0.5pt solid #D1D5DB" fo:padding="0.06in"/>
    </style:style>
    <style:style style:name="DemosTableCell" style:family="table-cell">
      <style:table-cell-properties fo:border="0.5pt solid #D1D5DB" fo:padding="0.06in"/>
    </style:style>
  `;
}

function initiativeSignaturesDocxTable(signatures) {
  if (!signatures.length) {
    return docxParagraph("Podpisi niso evidentirani.", { color: "4B5563", size: 19, spacingAfter: 140 });
  }

  const rows = [
    [
      { text: "Podpisnik", bold: true, shading: "F3F4F6", width: 2600 },
      { text: "Identifikator", bold: true, shading: "F3F4F6", width: 3400 },
      { text: "Metoda", bold: true, shading: "F3F4F6", width: 1700 },
      { text: "Datum", bold: true, shading: "F3F4F6", width: 2500 }
    ],
    ...signatures.map((signature) => [
      { text: signature.userName, width: 2600 },
      { text: signature.userId, width: 3400 },
      { text: signature.method || "demo", width: 1700 },
      { text: formatDate(signature.createdAt), width: 2500 }
    ])
  ];

  return docxTable(rows);
}

function docxHeading(text) {
  return docxParagraph(text, {
    bold: true,
    size: 26,
    bottomBorder: "D1D5DB",
    spacingBefore: 220,
    spacingAfter: 100
  });
}

function docxTextBlock(value) {
  const paragraphs = String(value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (paragraphs.length ? paragraphs : [""]).map((paragraph) => docxParagraph(paragraph, { spacingAfter: 120 })).join("");
}

function docxKeyValueTable(rows) {
  return docxTable(
    rows.map(([label, value]) => [
      { text: label, bold: true, shading: "F3F4F6", width: 3100 },
      { text: value, width: 6900 }
    ])
  );
}

function docxTable(rows) {
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
        </w:tblBorders>
      </w:tblPr>
      ${rows.map((row) => `<w:tr>${row.map(docxTableCell).join("")}</w:tr>`).join("")}
    </w:tbl>
    ${docxParagraph("", { spacingAfter: 120 })}
  `;
}

function docxTableCell(cell) {
  return `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${Number(cell.width) || 5000}" w:type="dxa"/>
        <w:vAlign w:val="top"/>
        ${cell.shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${escapeXml(cell.shading)}"/>` : ""}
      </w:tcPr>
      ${docxParagraph(cell.text, { bold: cell.bold, size: 20, spacingAfter: 0 })}
    </w:tc>
  `;
}

function docxParagraph(text, options = {}) {
  return `<w:p>${docxParagraphProperties(options)}${docxRun(text, options)}</w:p>`;
}

function docxParagraphProperties(options) {
  const props = [];
  const spacing = [];
  if (options.spacingBefore !== undefined) spacing.push(`w:before="${Number(options.spacingBefore) || 0}"`);
  if (options.spacingAfter !== undefined) spacing.push(`w:after="${Number(options.spacingAfter) || 0}"`);

  const borders = [];
  if (options.topBorder) {
    borders.push(docxBorder("top", options.topBorder, options.topBorderSize || 4, 4));
  }
  if (options.bottomBorder) {
    borders.push(docxBorder("bottom", options.bottomBorder, options.bottomBorderSize || 4, 4));
  }
  if (options.boxBorder) {
    borders.push(
      docxBorder("top", options.boxBorder),
      docxBorder("left", options.boxBorder),
      docxBorder("bottom", options.boxBorder),
      docxBorder("right", options.boxBorder)
    );
  }
  if (borders.length) props.push(`<w:pBdr>${borders.join("")}</w:pBdr>`);
  if (options.shading) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${escapeXml(options.shading)}"/>`);
  if (spacing.length) props.push(`<w:spacing ${spacing.join(" ")}/>`);

  return props.length ? `<w:pPr>${props.join("")}</w:pPr>` : "";
}

function docxBorder(side, color, size = 4, space = 1) {
  return `<w:${side} w:val="single" w:sz="${Number(size) || 4}" w:space="${Number(space) || 0}" w:color="${escapeXml(color)}"/>`;
}

function docxRun(text, options = {}) {
  const textParts = String(text ?? "").split("\n");
  const runProperties = docxRunProperties(options);

  return textParts
    .map((part, index) => {
      const lineBreak = index === 0 ? "" : "<w:br/>";
      return `<w:r>${runProperties}${lineBreak}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    })
    .join("");
}

function docxRunProperties(options) {
  const props = [];
  if (options.bold) props.push("<w:b/>");
  if (options.color) props.push(`<w:color w:val="${escapeXml(options.color)}"/>`);
  if (options.size) {
    const size = Number(options.size) || 22;
    props.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
  }

  return props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
}

function docxContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function docxPackageRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function docxDocumentRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function docxCorePropertiesXml(initiative, user, generatedAt) {
  const title = docxDocumentTitle(initiative);
  const creator = user?.name || user?.id || "Demokracija 2.0";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:subject>Izvoz zakonodajne pobude za DZ</dc:subject>
  <dc:creator>${escapeXml(creator)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(creator)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(new Date(generatedAt).toISOString())}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(new Date(generatedAt).toISOString())}</dcterms:modified>
</cp:coreProperties>`;
}

function docxAppPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Demokracija 2.0</Application>
</Properties>`;
}

function docxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="111827"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
      <w:color w:val="111827"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function odtManifestXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME_TYPE}"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
}

function odtMetaXml(initiative, user, generatedAt) {
  const title = docxDocumentTitle(initiative);
  const creator = user?.name || user?.id || "Demokracija 2.0";
  const timestamp = new Date(generatedAt).toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3">
  <office:meta>
    <meta:generator>Demokracija 2.0</meta:generator>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:subject>Izvoz zakonodajne pobude za DZ</dc:subject>
    <dc:creator>${escapeXml(creator)}</dc:creator>
    <meta:creation-date>${escapeXml(timestamp)}</meta:creation-date>
    <dc:date>${escapeXml(timestamp)}</dc:date>
  </office:meta>
</office:document-meta>`;
}

function odtStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
  <office:font-face-decls>
    <style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0in" fo:margin-bottom="0.08in" fo:line-height="125%"/>
      <style:text-properties style:font-name="Arial" fo:font-size="11pt" fo:color="#111827"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text">
      <style:text-properties style:font-name="Arial" fo:font-size="11pt" fo:color="#111827"/>
    </style:style>
    <style:style style:name="DemosBody" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.1in" fo:line-height="130%"/>
    </style:style>
    <style:style style:name="DemosBrand" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.03in"/>
      <style:text-properties fo:font-size="9pt" fo:font-weight="bold" fo:color="#0F766E"/>
    </style:style>
    <style:style style:name="DemosTitle" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.08in"/>
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="DemosMuted" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.12in"/>
      <style:text-properties fo:font-size="9.5pt" fo:color="#4B5563"/>
    </style:style>
    <style:style style:name="DemosHeading" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.16in" fo:margin-bottom="0.07in" fo:border-bottom="0.5pt solid #D1D5DB" fo:padding-bottom="0.03in"/>
      <style:text-properties fo:font-size="13pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="DemosSummary" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.14in" fo:background-color="#ECFDF5" fo:border="0.5pt solid #99F6E4" fo:padding="0.08in"/>
    </style:style>
    <style:style style:name="DemosSignatureLine" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.24in" fo:margin-bottom="0.02in"/>
    </style:style>
    <style:style style:name="DemosFooter" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.12in" fo:border-top="0.5pt solid #D1D5DB" fo:padding-top="0.06in"/>
      <style:text-properties fo:font-size="9pt" fo:color="#4B5563"/>
    </style:style>
    <style:style style:name="DemosSpacer" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.1in"/>
    </style:style>
    <style:style style:name="DemosTableText" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0in" fo:margin-bottom="0in"/>
      <style:text-properties fo:font-size="10pt"/>
    </style:style>
    <style:style style:name="DemosBold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
  </office:styles>
</office:document-styles>`;
}

function createZipArchive(files, modifiedAt) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const dateTime = zipDateTime(modifiedAt);
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = typeof file.content === "string" ? encoder.encode(file.content) : new Uint8Array(file.content);
    const checksum = crc32(dataBytes);
    const localHeader = zipLocalFileHeader(nameBytes, dataBytes.length, checksum, dateTime);
    const centralHeader = zipCentralDirectoryHeader(nameBytes, dataBytes.length, checksum, dateTime, offset);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = zipEndOfCentralDirectory(files.length, centralSize, centralOffset);
  const totalLength =
    localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + endRecord.length;
  const output = new Uint8Array(totalLength);
  let position = 0;

  for (const part of [...localParts, ...centralParts, endRecord]) {
    output.set(part, position);
    position += part.length;
  }

  return output;
}

function zipLocalFileHeader(nameBytes, size, checksum, dateTime) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dateTime.time, true);
  view.setUint16(12, dateTime.date, true);
  view.setUint32(14, checksum, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);

  return header;
}

function zipCentralDirectoryHeader(nameBytes, size, checksum, dateTime, localOffset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, dateTime.time, true);
  view.setUint16(14, dateTime.date, true);
  view.setUint32(16, checksum, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  header.set(nameBytes, 46);

  return header;
}

function zipEndOfCentralDirectory(fileCount, centralSize, centralOffset) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(value) {
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));

  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function docxDocumentTitle(initiative) {
  const title = String(initiative?.title || "pobuda")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `Demos - ${title}`;
}

function initiativeExportBaseName(initiative) {
  const title = String(initiative?.title || "pobuda")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return `demos-${title || "pobuda"}-dz-izvoz`;
}

function formatDate(value) {
  if (!value) return "ni datuma";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ni datuma";
  return date.toLocaleDateString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
