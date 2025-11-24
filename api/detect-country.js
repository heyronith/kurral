const IPAPI_BASE = 'https://ipapi.co';

const extractClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const headerValue = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
    for (const ip of headerValue.split(',')) {
      const trimmed = ip.trim();
      if (trimmed && !trimmed.startsWith('127.') && trimmed !== '::1') {
        return trimmed;
      }
    }
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return null;
};

const createIpapiUrl = (ip) => {
  if (ip) {
    return `${IPAPI_BASE}/${encodeURIComponent(ip)}/json/`;
  }
  return `${IPAPI_BASE}/json/`;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = createIpapiUrl(extractClientIp(req));

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ipapi.co responded with ${response.status}`);
    }

    const payload = await response.json();
    const countryCode = typeof payload?.country_code === 'string'
      ? payload.country_code.trim().toUpperCase()
      : '';

    if (!countryCode) {
    return res.status(204).end();
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).json({ countryCode });
  } catch (error) {
    console.error('[detect-country] failed to resolve country', error);
    return res.status(500).json({ error: 'Failed to detect country' });
  }
}

