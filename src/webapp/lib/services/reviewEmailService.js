import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
const sendReviewRequestEmailFn = httpsCallable(functions, 'sendReviewRequestEmail');
export const reviewEmailService = {
    async sendReviewRequestEmail(payload) {
        const result = await sendReviewRequestEmailFn(payload);
        return result.data;
    },
};
