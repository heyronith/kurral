import '../src/webapp/lib/firebase';
import { newsPipelineService } from '../src/webapp/lib/services/newsPipelineService';

const isAllowedMethod = (method?: string) => method === 'GET' || method === 'POST';

export default async function handler(req: any, res: any) {
  if (!isAllowedMethod(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const assignments = await newsPipelineService.runOnce();
    return res.status(200).json({
      success: true,
      assignments: assignments.length,
    });
  } catch (error) {
    console.error('[bot-pipeline] Execution error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || 'pipeline failed',
    });
  }
}
