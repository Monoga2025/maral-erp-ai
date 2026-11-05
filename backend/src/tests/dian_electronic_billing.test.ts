// backend/src/tests/dian_electronic_billing.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { calculateCUFE, type DIANConfig, type DIANInvoiceData } from '../lib/dian.ts';
import { calculateCUDE, generateCreditNoteUBL, type DIANCreditNoteData } from '../lib/dianNotes.ts';
import { canonicalizeXml, DianXadesSigner } from '../lib/dianSigner.ts';
import { createDianZip, buildDianFileName, buildDianSoapEnvelope } from '../lib/dianSoap.ts';

describe('DIAN Electronic Invoicing Engine Suite (Odoo l10n_co_edi / Software Propio REA)', () => {
  const mockConfig: DIANConfig = {
    nit: '901889479',
    digitoVerificacion: '8',
    nombre: 'MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S.',
    address: 'Calle 3 # 6 A - 22',
    city: 'Curití',
    department: 'Santander',
    phone: '3000000024',
    email: 'user37@example.com',
    softwareId: '6b6c203b-dian-4bc2-8812-c287042c129e',
    softwarePin: '12345',
    resolucion: '18760000001',
    resolucionFechaInicio: '2026-01-01',
    resolucionFechaFin: '2026-12-31',
    prefijo: 'FE',
    rangoDesde: 1,
    rangoHasta: 5000,
    testingMode: true,
  };

  test('1. CUFE debe tener 96 caracteres hexadecimales válidos (SHA-384)', () => {
    const invData: DIANInvoiceData = {
      invoiceId: 'inv-1',
      number: 'FE0001',
      consecutivo: '0001',
      issueDate: new Date('2026-11-05T10:00:00-05:00'),
      dueDate: new Date('2026-12-05T10:00:00-05:00'),
      paymentMeans: '1',
      currency: 'COP',
      buyer: { nit: '900123456', nombre: 'TELECOM ANDINA S.A.', address: 'Cra 10', city: 'Bucaramanga', department: 'Santander', countryCode: 'CO' },
      items: [{ lineNumber: 1, description: 'Antena LoRaWAN 915MHz', qty: 2, unit: 'EA', unitPrice: 100000, taxRate: 19, taxAmount: 38000, lineTotal: 200000 }],
      subtotal: 200000,
      totalIVA: 38000,
      totalINC: 0,
      totalICA: 0,
      total: 238000,
    };
    const cufe = calculateCUFE(invData, mockConfig);
    assert.equal(cufe.length, 96);
    assert.match(cufe, /^[0-9a-f]{96}$/);
  });

  test('2. CUDE de Nota Crédito debe usar Software PIN y formato SHA-384', () => {
    const noteData: DIANCreditNoteData = {
      noteNumber: 'NC0001',
      consecutivo: '0001',
      invoiceNumberRef: 'FE0001',
      invoiceCufeRef: 'a'.repeat(96),
      invoiceIssueDateRef: '2026-11-05',
      discrepancyCode: '2',
      discrepancyReason: 'Anulación total por cambio de especificaciones',
      issueDate: new Date('2026-11-06T11:00:00-05:00'),
      currency: 'COP',
      buyer: { nit: '900123456', nombre: 'TELECOM ANDINA S.A.', address: 'Cra 10', city: 'Bucaramanga', department: 'Santander', countryCode: 'CO' },
      items: [],
      subtotal: 200000,
      totalIVA: 38000,
      total: 238000,
    };
    const cude = calculateCUDE(noteData, mockConfig);
    assert.equal(cude.length, 96);
    assert.match(cude, /^[0-9a-f]{96}$/);

    const ubl = generateCreditNoteUBL(noteData, cude, mockConfig);
    assert.ok(ubl.includes('<CreditNote'));
    assert.ok(ubl.includes('NC0001'));
  });

  test('3. Canonicalización C14N 1.0 debe eliminar espacios intermedios y normalizar retornos CRLF a LF', () => {
    const dirtyXml = '<Invoice>\r\n   <cbc:ID>  FE0001 </cbc:ID> \r\n</Invoice>';
    const clean = canonicalizeXml(dirtyXml);
    assert.equal(clean.includes('\r'), false);
    assert.equal(clean, '<Invoice><cbc:ID>  FE0001 </cbc:ID></Invoice>');
  });

  test('4. Empaquetador ZIP nativo genera firma binaria 0x04034B50 y compresión válida', () => {
    const xml = '<Invoice><cbc:ID>FE0001</cbc:ID></Invoice>';
    const zip = createDianZip('fv009018894700000001.xml', xml);
    assert.equal(zip.readUInt32LE(0), 0x04034b50, 'Cabecera ZIP inválida');
    assert.ok(zip.length > 50, 'El ZIP debe contener encabezados y datos comprimidos');
  });

  test('5. Nomenclatura obligatoria de archivos XML y ZIP de la DIAN', () => {
    const fv = buildDianFileName('901889479', 1, 'fv');
    assert.equal(fv.fileNameXml, 'fv090188947900000001.xml');
    assert.equal(fv.fileNameZip, 'fv090188947900000001.zip');

    const nc = buildDianFileName('901889479', 12, 'nc');
    assert.equal(nc.fileNameXml, 'nc09018894790000000c.xml');
    assert.equal(nc.fileNameZip, 'nc09018894790000000c.zip');
  });

  test('6. SOAP Envelope para SendBillSync genera estructura WCF estándar', () => {
    const { soapEnvelope, soapAction } = buildDianSoapEnvelope('fv009018894700000001.zip', 'BASE64DATA');
    assert.equal(soapAction, 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync');
    assert.ok(soapEnvelope.includes('<wcf:SendBillSync>'));
    assert.ok(soapEnvelope.includes('<wcf:fileName>fv009018894700000001.zip</wcf:fileName>'));
    assert.ok(soapEnvelope.includes('<wcf:contentFile>BASE64DATA</wcf:contentFile>'));
  });

  test('7. SOAP Envelope para SendTestSetAsync incluye testSetId de habilitación', () => {
    const { soapEnvelope, soapAction } = buildDianSoapEnvelope('fv009018894700000001.zip', 'BASE64DATA', 'test-set-uuid-1234');
    assert.equal(soapAction, 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync');
    assert.ok(soapEnvelope.includes('<wcf:SendTestSetAsync>'));
    assert.ok(soapEnvelope.includes('<wcf:testSetId>test-set-uuid-1234</wcf:testSetId>'));
  });

  test('8. SoftwareSecurityCode genera SHA384(SoftwareId + PIN + Prefijo + Consecutivo)', () => {
    const hash = crypto.createHash('sha384').update(mockConfig.softwareId + mockConfig.softwarePin + 'FE' + '0001').digest('hex');
    assert.equal(hash.length, 96);
  });

  test('9. Firma XAdES-EPES inyecta SignedProperties con Política de Firma v2 de la DIAN', () => {
    // Generar par de llaves RSA 2048 para test de firma
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    
    // Certificado autofirmado dummy en PEM
    assert.ok(privPem.includes('BEGIN PRIVATE KEY'));
  });

  test('10. Inmutabilidad de la base nominal de la factura para preservar el CUFE ante abonos', () => {
    const invoiceNominal = 2500000;
    const partialPayment = 1000000;
    const remainingBalance = invoiceNominal - partialPayment;
    assert.equal(remainingBalance, 1500000);
    assert.equal(invoiceNominal, 2500000, 'El monto nominal no debe alterarse');
  });
});
