import '../src/webapp/lib/firebase';
import { botPostService } from '../src/webapp/lib/services/botPostService';

const isAllowedMethod = (method?: string) => method === 'GET' || method === 'POST';

export default async function handler(req: any, res: any) {
  if (!isAllowedMethod(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const result = await botPostService.dispatchDuePostsOnce();
    return res.status(200).json({
      success: true,
      dispatched: result.dispatched,
    });
  } catch (error) {
    console.error('[bot-dispatcher] Execution error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || 'dispatch failed',
    });
  }
}
