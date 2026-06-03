import { createHash } from "node:crypto";
import https from "node:https";
import { sessionUserFromRequest } from "./sipass-session.mjs";
import {
  fetchInitiativeDetail,
  requestJson,
  supabaseServerClient
} from "./initiatives.mjs";

const defaultEndpoint = "https://sicas-test.sigov.si/CES-Sign/SicesSign";
const defaultServiceProvider = "UNI-MB_eDemokracija";

export async function startSicesSignature(request, payload = {}, env = process.env, fetchImpl = fetch) {
  const user = sessionUserFromRequest(request, env);
  if (!user?.id || !String(user.id).startsWith("sipass-")) {
    throwHttp(401, "Za SI-CeS podpis je potrebna prijava s SI-PASS identiteto.");
  }

  const initiativeId = clean(payload.initiativeId || payload.id, 80);
  if (!initiativeId) throwHttp(400, "Manjka ID pobude.");

  const config = sicesConfig(env);
  const client = supabaseServerClient(env, fetchImpl);
  const initiative = await fetchInitiativeDetail(client, initiativeId);
  const document = buildInitiativeSignatureDocument(initiative, user);
  const soap = buildPutRequestSoap({
    serviceProvider: config.serviceProvider,
    callbackUrl: callbackUrl(config.callbackUrl, initiativeId),
    document,
    fileName: `pobuda-${initiativeId}.xml`,
    mimeType: "application/xml",
    signatureLevel: config.signatureLevel,
    signaturePackaging: config.signaturePackaging,
    trustLevel: config.trustLevel
  });
  const result = parsePutRequestResponse(await sendSicesSoap(soap, config));

  await upsertPendingSignature(client, {
    initiativeId,
    signerRef: user.id,
    signerName: user.name || "SI-PASS uporabnik",
    requestId: result.requestId,
    documentHash: sha256Hex(document)
  });

  return {
    requestId: result.requestId,
    redirectUrl: result.url,
    initiative
  };
}

export async function completeSicesSignature(request, query = {}, env = process.env, fetchImpl = fetch) {
  const requestId = clean(query.requestid || query.requestId, 512);
  const status = String(query.status || "").toLowerCase();
  const initiativeId = clean(query.initiativeId || query.initiativeid, 80);
  const callbackError = clean(query.error, 512);

  if (!requestId) throwHttp(400, "Manjka SI-CeS requestid.");
  const config = sicesConfig(env);
  const client = supabaseServerClient(env, fetchImpl);
  const signature = await findSignatureBySicesRequestId(client, requestId);
  if (!signature) throwHttp(404, "SI-CeS podpisni zahtevek ni najden.");
  const finalInitiativeId = initiativeId || signature.initiative_id;

  if (status !== "true") {
    await updateSignatureSicesStatus(client, signature.id, {
      signatureStatus: "NOTSIGNED",
      error: callbackError || "SI-CeS podpis ni uspel."
    });
    return {
      signed: false,
      initiativeId: finalInitiativeId,
      error: callbackError || "SI-CeS podpis ni uspel."
    };
  }

  const soap = buildGetSignedDataSoap({
    serviceProvider: config.serviceProvider,
    requestId
  });
  const signedData = parseGetSignedDataResponse(await sendSicesSoap(soap, config));
  if (signedData.status !== "SIGNED") {
    await updateSignatureSicesStatus(client, signature.id, {
      signatureStatus: signedData.status || "NOTSIGNED"
    });
    return {
      signed: false,
      initiativeId: finalInitiativeId,
      error: `SI-CeS je vrnil status ${signedData.status || "UNKNOWN"}.`
    };
  }

  await updateSignatureSicesStatus(client, signature.id, {
    signatureStatus: "SIGNED",
    cesId: signedData.cesId,
    signedDocumentHash: signedData.documentBytes ? sha256Hex(Buffer.from(signedData.documentBytes, "base64")) : "",
    certificateChain: signedData.certificateChain
  });

  if (signature.initiative_status === "active") {
    await requestJson(client, `/rest/v1/initiatives?id=eq.${encodeURIComponent(finalInitiativeId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "signature_collection",
        updated_at: new Date().toISOString()
      })
    });
  }

  return {
    signed: true,
    initiativeId: finalInitiativeId,
    cesId: signedData.cesId
  };
}

export async function acknowledgeSicesCallback(query = {}, env = process.env, fetchImpl = fetch) {
  const requestId = clean(query.requestid || query.requestId, 512);
  const status = String(query.status || "").toLowerCase();
  const callbackError = clean(query.error, 512);

  if (!requestId) throwHttp(400, "Manjka SI-CeS requestid.");
  const client = supabaseServerClient(env, fetchImpl);
  const signature = await findSignatureBySicesRequestId(client, requestId);
  if (!signature) throwHttp(404, "SI-CeS podpisni zahtevek ni najden.");

  if (status !== "true") {
    await updateSignatureSicesStatus(client, signature.id, {
      signatureStatus: "NOTSIGNED",
      error: callbackError || "SI-CeS podpis ni uspel."
    });
    return {
      signed: false,
      readyForCompletion: false,
      requestId,
      initiativeId: signature.initiative_id,
      error: callbackError || "SI-CeS podpis ni uspel."
    };
  }

  return {
    signed: false,
    readyForCompletion: true,
    requestId,
    initiativeId: signature.initiative_id
  };
}

export function sicesConfig(env = process.env) {
  const endpoint = firstValue(env.SICES_ENDPOINT, env.SICES_WSDL_URL, defaultEndpoint).replace(/\?wsdl$/i, "");
  const serviceProvider = firstValue(env.SICES_SERVICE_PROVIDER, defaultServiceProvider);
  const pfxBase64 = firstValue(env.SICES_PFX_BASE64);
  const pfxPassword = firstValue(env.SICES_PFX_PASSWORD, env.SICES_CERT_PASS);
  const callback = firstValue(env.SICES_CALLBACK_URL);

  if (!pfxBase64) throwHttp(503, "SICES_PFX_BASE64 mora biti nastavljen na strezniku.");
  if (!pfxPassword) throwHttp(503, "SICES_PFX_PASSWORD mora biti nastavljen na strezniku.");
  if (!callback) throwHttp(503, "SICES_CALLBACK_URL mora biti nastavljen na strezniku.");

  return {
    endpoint,
    serviceProvider,
    pfx: Buffer.from(pfxBase64.replace(/\s+/g, ""), "base64"),
    pfxPassword,
    callbackUrl: callback,
    trustLevel: firstValue(env.SICES_TRUST_LEVEL, "MEDIUM").toUpperCase(),
    signatureLevel: firstValue(env.SICES_SIGNATURE_LEVEL, "XAdES_BASELINE_B"),
    signaturePackaging: firstValue(env.SICES_SIGNATURE_PACKAGING, "ENVELOPED")
  };
}

export function buildPutRequestSoap(options) {
  const documentBytes = Buffer.from(options.document, "utf8").toString("base64");
  return soapEnvelope(`
    <ws:putRequest>
      <serviceProvider>${xml(options.serviceProvider)}</serviceProvider>
      <callback>${xml(options.callbackUrl)}</callback>
      <item>
        <document>
          <bytes>${documentBytes}</bytes>
          <mimeType>
            <mimeTypeString>${xml(options.mimeType)}</mimeTypeString>
          </mimeType>
          <name>${xml(options.fileName)}</name>
        </document>
        <parameters>
          <digestAlgorithm>SHA256</digestAlgorithm>
          <encryptionAlgorithm>RSA</encryptionAlgorithm>
          <signatureLevel>${xml(options.signatureLevel)}</signatureLevel>
          <signaturePackaging>${xml(options.signaturePackaging)}</signaturePackaging>
        </parameters>
      </item>
      <trustLevel>${xml(options.trustLevel)}</trustLevel>
    </ws:putRequest>
  `);
}

export function buildGetSignedDataSoap(options) {
  return soapEnvelope(`
    <ws:getSignedData>
      <serviceProvider>${xml(options.serviceProvider)}</serviceProvider>
      <requestId>${xml(options.requestId)}</requestId>
    </ws:getSignedData>
  `);
}

function soapEnvelope(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.sign.sices.osi.si/">
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function sendSicesSoap(soap, config) {
  const endpoint = new URL(config.endpoint);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || 443,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        pfx: config.pfx,
        passphrase: config.pfxPassword,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(soap, "utf8")
        },
        timeout: 30000
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const error = new Error(`SI-CeS SOAP klic ni uspel (${res.statusCode}).`);
            error.status = 502;
            error.details = body;
            reject(error);
            return;
          }
          if (/<(?:\w+:)?Fault\b/i.test(body)) {
            const error = new Error(soapText(body, "faultstring") || soapText(body, "Reason") || "SI-CeS SOAP fault.");
            error.status = 502;
            error.details = body;
            reject(error);
            return;
          }
          resolve(body);
        });
      }
    );
    req.on("error", (error) => {
      error.status = 502;
      reject(error);
    });
    req.on("timeout", () => {
      req.destroy();
      const error = new Error("SI-CeS SOAP klic je potekel.");
      error.status = 504;
      reject(error);
    });
    req.write(soap);
    req.end();
  });
}

export function parsePutRequestResponse(xmlText) {
  const requestId = soapText(xmlText, "requestId");
  const url = soapText(xmlText, "URL");
  if (!requestId || !url) throwHttp(502, "SI-CeS putRequest ni vrnil requestId in URL.");
  return { requestId, url };
}

export function parseGetSignedDataResponse(xmlText) {
  return {
    status: soapText(xmlText, "status"),
    cesId: soapText(xmlText, "cesid") || soapText(xmlText, "cesId"),
    documentBytes: soapText(xmlText, "bytes"),
    certificateChain: soapTexts(xmlText, "certificate")
  };
}

async function upsertPendingSignature(client, signature) {
  const initiative = await requestJson(
    client,
    `/rest/v1/initiatives?select=status&id=eq.${encodeURIComponent(signature.initiativeId)}&limit=1`
  );
  const existing = await requestJson(
    client,
    `/rest/v1/signatures?select=id&initiative_id=eq.${encodeURIComponent(signature.initiativeId)}&signer_ref=eq.${encodeURIComponent(signature.signerRef)}&limit=1`
  );
  const body = {
    initiative_id: signature.initiativeId,
    signer_ref: signature.signerRef,
    signer_name: signature.signerName,
    method: "sices",
    sices_request_id: signature.requestId,
    signed_document_hash: signature.documentHash,
    signature_status: "PENDING"
  };

  if (existing.length) {
    await requestJson(client, `/rest/v1/signatures?id=eq.${encodeURIComponent(existing[0].id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body)
    });
    return;
  }

  await requestJson(client, "/rest/v1/signatures", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body)
  });

  if (initiative[0]?.status === "active") {
    await requestJson(client, `/rest/v1/initiatives?id=eq.${encodeURIComponent(signature.initiativeId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "signature_collection",
        updated_at: new Date().toISOString()
      })
    });
  }
}

async function findSignatureBySicesRequestId(client, requestId) {
  const rows = await requestJson(
    client,
    `/rest/v1/signatures?select=*&sices_request_id=eq.${encodeURIComponent(requestId)}&limit=1`
  );
  const row = rows[0] || null;
  if (!row) return null;
  const initiativeRows = await requestJson(
    client,
    `/rest/v1/initiatives?select=status&id=eq.${encodeURIComponent(row.initiative_id)}&limit=1`
  );
  return {
    ...row,
    initiative_status: initiativeRows[0]?.status || ""
  };
}

async function updateSignatureSicesStatus(client, id, values) {
  await requestJson(client, `/rest/v1/signatures?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      method: "sices",
      sices_ces_id: values.cesId || null,
      signed_document_hash: values.signedDocumentHash || undefined,
      certificate_chain: values.certificateChain || undefined,
      signature_status: values.signatureStatus
    })
  });
}

function buildInitiativeSignatureDocument(initiative, user) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<demokracijaSignatureRequest>
  <initiative id="${xml(initiative.id)}">
    <title>${xml(initiative.title)}</title>
    <category>${xml(initiative.category)}</category>
    <status>${xml(initiative.status)}</status>
    <summary>${xml(initiative.summary)}</summary>
    <description>${xml(initiative.description)}</description>
    <legalReference>${xml(initiative.legalReference)}</legalReference>
    <expectedImpact>${xml(initiative.expectedImpact)}</expectedImpact>
    <legislativeText>${xml(initiative.legislativeText)}</legislativeText>
    <articleExplanation>${xml(initiative.articleExplanation)}</articleExplanation>
  </initiative>
  <signer ref="${xml(user.id)}">
    <name>${xml(user.name)}</name>
  </signer>
  <createdAt>${new Date().toISOString()}</createdAt>
</demokracijaSignatureRequest>`;
}

function callbackUrl(baseUrl, initiativeId) {
  const url = new URL(baseUrl);
  url.searchParams.set("initiativeId", initiativeId);
  return url.toString();
}

function soapText(body, tag) {
  return unescapeXml(soapTexts(body, tag)[0] || "");
}

function soapTexts(body, tag) {
  const pattern = new RegExp(`<(?:\\w+:)?${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${escapeRegExp(tag)}>`, "gi");
  return [...String(body || "").matchAll(pattern)].map((match) => match[1].trim());
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function throwHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
