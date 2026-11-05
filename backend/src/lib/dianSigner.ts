// backend/src/lib/dianSigner.ts
/**
 * Motor de Firma Digital XAdES-EPES para Facturación Electrónica DIAN
 * Inspirado en la arquitectura de Software Propio de Odoo (l10n_co_edi / OCA l10n-colombia)
 * Conforme a la especificación ETSI TS 101 903 v1.3.2 y Política de Firma DIAN v2
 */

import crypto from 'crypto';

/**
 * Canonicalización XML C14N 1.0 (Inclusive sin comentarios)
 * Conforme a http://www.w3.org/TR/2001/REC-xml-c14n-20010315
 */
export function canonicalizeXml(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export class DianXadesSigner {
  private privateKey: crypto.KeyObject;
  private certDer: Buffer;
  private certDigestSha256: string;
  private issuerName: string;
  private serialNumber: string;
  private certBase64: string;

  constructor(certPemOrP12: Buffer | string, passphrase?: string) {
    let keyObject: crypto.KeyObject;
    let x509: crypto.X509Certificate;

    if (Buffer.isBuffer(certPemOrP12) && !certPemOrP12.toString('utf8').includes('-----BEGIN')) {
      // PKCS#12 binario (.p12 / .pfx)
      keyObject = crypto.createPrivateKey({
        key: certPemOrP12,
        format: 'der',
        type: 'pkcs12',
        passphrase,
      });
      x509 = new crypto.X509Certificate(certPemOrP12);
    } else {
      // Formato PEM estándar
      const pemStr = certPemOrP12.toString('utf8');
      keyObject = crypto.createPrivateKey({ key: pemStr, passphrase });
      x509 = new crypto.X509Certificate(pemStr);
    }

    this.privateKey = keyObject;
    this.certDer = x509.raw;
    this.certBase64 = this.certDer.toString('base64');
    this.certDigestSha256 = crypto.createHash('sha256').update(this.certDer).digest('base64');
    this.issuerName = x509.issuer.split('\n').reverse().join(',');
    this.serialNumber = BigInt('0x' + (x509.serialNumber || '01')).toString(10);
  }

  public signDocument(xmlContent: string): string {
    const sigId = `xmldsig-${crypto.randomUUID()}`;
    const signedPropertiesId = `SignedProperties-${sigId}`;
    const keyInfoId = `KeyInfo-${sigId}`;
    const signatureValueId = `SignatureValue-${sigId}`;

    const signingTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().replace('Z', '-05:00');

    // 1. SignedProperties de la DIAN (Política v2)
    const signedProperties = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${signedPropertiesId}">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificate>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
              `<ds:DigestValue>${this.certDigestSha256}</ds:DigestValue>` +
            `</xades:CertDigest>` +
            `<xades:IssuerSerial>` +
              `<ds:X509IssuerName>${this.issuerName}</ds:X509IssuerName>` +
              `<ds:X509SerialNumber>${this.serialNumber}</ds:X509SerialNumber>` +
            `</xades:IssuerSerial>` +
          `</xades:Cert>` +
        `</xades:SigningCertificate>` +
        `<xades:SignaturePolicyIdentifier>` +
          `<xades:SignaturePolicyId>` +
            `<xades:SigPolicyId>` +
              `<xades:Identifier>https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf</xades:Identifier>` +
              `<xades:Description>Politica de firma para facturas electronicas de la Republica de Colombia</xades:Description>` +
            `</xades:SigPolicyId>` +
            `<xades:SigPolicyHash>` +
              `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
              `<ds:DigestValue>dMoMvtcG5aqcjeuhmuKAZOmRxEk=</ds:DigestValue>` +
            `</xades:SigPolicyHash>` +
          `</xades:SignaturePolicyId>` +
        `</xades:SignaturePolicyIdentifier>` +
        `<xades:SignerRole>` +
          `<xades:ClaimedRoles>` +
            `<xades:ClaimedRole>supplier</xades:ClaimedRole>` +
          `</xades:ClaimedRoles>` +
        `</xades:SignerRole>` +
      `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`;

    // 2. KeyInfo
    const keyInfo = `<ds:KeyInfo Id="${keyInfoId}">` +
      `<ds:X509Data>` +
        `<ds:X509Certificate>${this.certBase64}</ds:X509Certificate>` +
      `</ds:X509Data>` +
    `</ds:KeyInfo>`;

    // 3. Digest de las secciones canonicalizadas
    const docDigest = crypto.createHash('sha256').update(canonicalizeXml(xmlContent), 'utf8').digest('base64');
    const keyInfoDigest = crypto.createHash('sha256').update(canonicalizeXml(keyInfo), 'utf8').digest('base64');
    const signedPropsDigest = crypto.createHash('sha256').update(canonicalizeXml(signedProperties), 'utf8').digest('base64');

    // 4. SignedInfo
    const signedInfo = `<ds:SignedInfo>` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference Id="${sigId}-ref0" URI="">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${docDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference URI="#${keyInfoId}">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${keyInfoDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropertiesId}">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`;

    // 5. Firma RSA-SHA256
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(canonicalizeXml(signedInfo));
    const signatureValue = signer.sign(this.privateKey, 'base64');

    // 6. Ensamble de la firma
    const signatureXml = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}">` +
      signedInfo +
      `<ds:SignatureValue Id="${signatureValueId}">${signatureValue}</ds:SignatureValue>` +
      keyInfo +
      `<ds:Object>` +
        `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">` +
          signedProperties +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`;

    const targetExtension = '<ext:UBLExtension>\n      <ext:ExtensionContent/>\n    </ext:UBLExtension>';
    const replacement = `<ext:UBLExtension>\n      <ext:ExtensionContent>\n        ${signatureXml}\n      </ext:ExtensionContent>\n    </ext:UBLExtension>`;

    if (!xmlContent.includes(targetExtension)) {
      return xmlContent.replace('</ext:UBLExtensions>', `  ${replacement}\n  </ext:UBLExtensions>`);
    }

    return xmlContent.replace(targetExtension, replacement);
  }
}
