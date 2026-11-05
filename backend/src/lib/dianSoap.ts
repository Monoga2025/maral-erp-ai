// backend/src/lib/dianSoap.ts
/**
 * Empaquetador ZIP en memoria y Cliente SOAP WCF para DIAN Facturación Electrónica
 * Sin dependencias binarias externas (Usa Node.js zlib nativo)
 */

import zlib from 'zlib';

/**
 * Empaquetador ZIP nativo conforme al Anexo Técnico de la DIAN
 */
export function createDianZip(fileNameXml: string, xmlContent: string): Buffer {
  const fileData = Buffer.from(xmlContent, 'utf8');
  const fileNameBuffer = Buffer.from(fileNameXml, 'ascii');
  const compressedData = zlib.deflateRawSync(fileData);

  const crc = crc32(fileData);
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  // Local file header (30 bytes + filename)
  const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
  localHeader.writeUInt32LE(0x04034b50, 0); // Signature
  localHeader.writeUInt16LE(20, 4);          // Version needed
  localHeader.writeUInt16LE(0, 6);           // Flags
  localHeader.writeUInt16LE(8, 8);           // Compression (deflate)
  localHeader.writeUInt16LE(time, 10);
  localHeader.writeUInt16LE(date, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressedData.length, 18);
  localHeader.writeUInt32LE(fileData.length, 22);
  localHeader.writeUInt16LE(fileNameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  fileNameBuffer.copy(localHeader, 30);

  // Central directory header (46 bytes + filename)
  const centralHeader = Buffer.alloc(46 + fileNameBuffer.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt16LE(time, 12);
  centralHeader.writeUInt16LE(date, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressedData.length, 20);
  centralHeader.writeUInt32LE(fileData.length, 24);
  centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42); // Offset of local header
  fileNameBuffer.copy(centralHeader, 46);

  // End of central directory record (22 bytes)
  const centralDirOffset = localHeader.length + compressedData.length;
  const centralDirSize = centralHeader.length;
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralDirSize, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, compressedData, centralHeader, endRecord]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildDianFileName(nit: string, number: string | number, type: 'fv' | 'nc' | 'nd' = 'fv'): {
  fileNameXml: string;
  fileNameZip: string;
} {
  const nitPadded = String(nit).replace(/\D/g, '').padStart(10, '0');
  const numInt = parseInt(String(number).replace(/\D/g, '') || '1', 10);
  const consecutivoHex = numInt.toString(16).padStart(8, '0');
  const baseName = `${type}${nitPadded}${consecutivoHex}`;
  return {
    fileNameXml: `${baseName}.xml`,
    fileNameZip: `${baseName}.zip`,
  };
}

export function buildDianSoapEnvelope(
  fileNameZip: string,
  zipBase64: string,
  testSetId?: string
): {
  soapEnvelope: string;
  soapAction: string;
} {
  const isTestSet = !!testSetId;
  const soapAction = isTestSet
    ? 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync'
    : 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync';

  const soapBody = isTestSet
    ? `<wcf:SendTestSetAsync>` +
        `<wcf:fileName>${fileNameZip}</wcf:fileName>` +
        `<wcf:contentFile>${zipBase64}</wcf:contentFile>` +
        `<wcf:testSetId>${testSetId}</wcf:testSetId>` +
      `</wcf:SendTestSetAsync>`
    : `<wcf:SendBillSync>` +
        `<wcf:fileName>${fileNameZip}</wcf:fileName>` +
        `<wcf:contentFile>${zipBase64}</wcf:contentFile>` +
      `</wcf:SendBillSync>`;

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wcf="http://wcf.dian.colombia">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>${soapBody}</soapenv:Body>` +
    `</soapenv:Envelope>`;

  return { soapEnvelope, soapAction };
}
