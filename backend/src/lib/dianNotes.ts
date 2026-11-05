// backend/src/lib/dianNotes.ts
/**
 * Motor de Notas Crédito y Débito DIAN con cálculo de CUDE
 * Conforme al Anexo Técnico 1.9 DIAN (Usa SoftwarePIN en lugar de ClaveTecnica)
 */

import crypto from 'crypto';
import type { DIANConfig, DIANParty, DIANItem } from './dian.ts';

export interface DIANCreditNoteData {
  noteNumber: string;         // ej: "NC0001"
  consecutivo: string;        // "0001"
  invoiceNumberRef: string;   // "FE0001"
  invoiceCufeRef: string;     // CUFE de la factura original (96 caracteres)
  invoiceIssueDateRef: string;// YYYY-MM-DD
  discrepancyCode: '1' | '2' | '3' | '4'; // 1=Devolución parcial, 2=Anulación total, 3=Rebaja, 4=Ajuste
  discrepancyReason: string;
  issueDate: Date;
  currency: string;
  buyer: DIANParty;
  items: DIANItem[];
  subtotal: number;
  totalIVA: number;
  total: number;
}

/**
 * Cálculo del CUDE (Código Único de Documento Electrónico) según Anexo Técnico 1.9 DIAN
 * Nota: Las notas usan SoftwarePIN en vez de ClaveTecnica
 */
export function calculateCUDE(note: DIANCreditNoteData, config: DIANConfig): string {
  const fec = note.issueDate.toISOString().split('T')[0];
  const hor = note.issueDate.toISOString().split('T')[1].slice(0, 8) + '-05:00';
  const valTot = note.total.toFixed(2);
  const valFac = note.subtotal.toFixed(2);
  const valIva = note.totalIVA.toFixed(2);
  const nitOFE = config.nit;
  const numAdq = note.buyer.nit.replace(/\D/g, '');
  const pin = config.softwarePin;
  const ambiente = config.testingMode ? '2' : '1';

  const raw = `${note.noteNumber}${fec}${hor}${valFac}01${valIva}040.00030.00${valTot}${nitOFE}${numAdq}${pin}${ambiente}`;
  return crypto.createHash('sha384').update(raw, 'utf8').digest('hex');
}

/**
 * Genera el XML UBL 2.1 para Nota Crédito DIAN (Tipo 91)
 */
export function generateCreditNoteUBL(note: DIANCreditNoteData, cude: string, config: DIANConfig): string {
  const fec = note.issueDate.toISOString().split('T')[0];
  const hor = note.issueDate.toISOString().split('T')[1].slice(0, 8) + '-05:00';
  const perfil = config.testingMode ? '2' : '1';

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sts:DianExtensions>
          <sts:InvoiceSource>
            <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe">CO</cbc:IdentificationCode>
          </sts:InvoiceSource>
          <sts:SoftwareProvider>
            <sts:ProviderID schemeAgencyID="195">${config.nit}</sts:ProviderID>
            <sts:SoftwareID schemeAgencyID="195">${config.softwareId}</sts:SoftwareID>
          </sts:SoftwareProvider>
          <sts:SoftwareSecurityCode schemeAgencyID="195">${crypto.createHash('sha384').update(config.softwareId + config.softwarePin + note.noteNumber).digest('hex')}</sts:SoftwareSecurityCode>
        </sts:DianExtensions>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>20</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ProfileExecutionID>${perfil}</cbc:ProfileExecutionID>
  <cbc:ID>${note.noteNumber}</cbc:ID>
  <cbc:UUID schemeID="${perfil}" schemeName="CUDE-SHA384">${cude}</cbc:UUID>
  <cbc:IssueDate>${fec}</cbc:IssueDate>
  <cbc:IssueTime>${hor}</cbc:IssueTime>
  <cbc:CreditNoteTypeCode listAgencyID="195">91</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>${note.currency}</cbc:DocumentCurrencyCode>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${note.invoiceNumberRef}</cbc:ReferenceID>
    <cbc:ResponseCode>${note.discrepancyCode}</cbc:ResponseCode>
    <cbc:Description>${note.discrepancyReason}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${note.invoiceNumberRef}</cbc:ID>
      <cbc:UUID schemeName="CUFE-SHA384">${note.invoiceCufeRef}</cbc:UUID>
      <cbc:IssueDate>${note.invoiceIssueDateRef}</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${config.nombre}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeID="${config.digitoVerificacion}" schemeName="31">${config.nit}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${note.buyer.nombre}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeID="0" schemeName="${note.buyer.tipoDoc ?? '31'}">${note.buyer.nit}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${note.currency}">${note.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${note.currency}">${note.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${note.currency}">${note.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${note.currency}">${note.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</CreditNote>`;
}
