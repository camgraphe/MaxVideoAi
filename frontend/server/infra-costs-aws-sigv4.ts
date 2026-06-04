import { createHash, createHmac } from 'node:crypto';

const AWS_DATE_STAMP_LENGTH = 8;

export function signAwsJsonRequest({
  url,
  body,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  region,
  service,
  target,
  contentType,
}: {
  url: URL;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | undefined;
  region: string;
  service: string;
  target: string;
  contentType: string;
}): Record<string, string> {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, AWS_DATE_STAMP_LENGTH);
  const canonicalUri = url.pathname || '/';
  const headers: Record<string, string> = {
    'content-type': contentType,
    host: url.host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };

  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const signedHeaderNames = sortedHeaderNames.join(';');
  const canonicalRequest = [
    'POST',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaderNames,
    sha256Hex(body),
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacHex(signingKey, stringToSign);

  const requestHeaders: Record<string, string> = {
    'content-type': headers['content-type'],
    'x-amz-date': headers['x-amz-date'],
    'x-amz-target': headers['x-amz-target'],
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  };

  if (sessionToken) {
    requestHeaders['x-amz-security-token'] = sessionToken;
  }

  return requestHeaders;
}

function toAmzDate(value: Date): string {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function hmacHex(key: Buffer | string, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, regionName);
  const dateRegionServiceKey = hmac(dateRegionKey, serviceName);
  return hmac(dateRegionServiceKey, 'aws4_request');
}
