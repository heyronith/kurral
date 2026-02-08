import * as admin from 'firebase-admin';

// Initialize admin if not already
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

const profilePictures: Record<string, string> = {
    kural: 'https://firebasestorage.googleapis.com/v0/b/chirp-web-7e581.firebasestorage.app/o/profile-pictures%2FdHDsIaWfHdRDWq0T6VsSwY5HLti1%2Fbot_kural.png?alt=media&token=49824fac-a708-4fbd-a3aa-965ac9e38d89',
    kuralbusiness: 'https://firebasestorage.googleapis.com/v0/b/chirp-web-7e581.firebasestorage.app/o/profile-pictures%2FdHDsIaWfHdRDWq0T6VsSwY5HLti1%2Fbot_kuralbusiness.png?alt=media&token=9f1c9880-7824-48ee-adc4-0ce996a8fb91',
    kuraltech: 'https://firebasestorage.googleapis.com/v0/b/chirp-web-7e581.firebasestorage.app/o/profile-pictures%2FdHDsIaWfHdRDWq0T6VsSwY5HLti1%2Fbot_kuraltech.png?alt=media&token=bef83ce1-2dca-45a8-856e-656e9a46abbd',
    kuralscience: 'https://firebasestorage.googleapis.com/v0/b/chirp-web-7e581.firebasestorage.app/o/profile-pictures%2FdHDsIaWfHdRDWq0T6VsSwY5HLti1%2Fbot_kuralscience.png?alt=media&token=054e676a-0820-4ed0-99cf-f8cd5d3620dc',
    kuralentertainment: 'https://firebasestorage.googleapis.com/v0/b/chirp-web-7e581.firebasestorage.app/o/profile-pictures%2FdHDsIaWfHdRDWq0T6VsSwY5HLti1%2Fbot_kuralentertainment.png?alt=media&token=c8b68f78-7b40-4e1e-9848-9c4818116a43'
};

const PLATFORM_ACCOUNTS = [
    { handle: 'kural', type: 'main' },
    { handle: 'kuralnews', type: 'news' },
    { handle: 'kuraltech', type: 'tech' },
    { handle: 'kuralscience', type: 'science' },
    { handle: 'kuralbusiness', type: 'business' },
    { handle: 'kuralsports', type: 'sports' },
    { handle: 'kuralhealth', type: 'health' },
    { handle: 'kuralentertainment', type: 'entertainment' },
    { handle: 'kuraldesign', type: 'design' },
    { handle: 'kuralgaming', type: 'gaming' },
];

async function run() {
    console.log('🔧 Updating Bot Avatars...');
    for (const account of PLATFORM_ACCOUNTS) {
        const query = await db.collection('users').where('handle', '==', account.handle).limit(1).get();
        if (!query.empty) {
            const updates: any = {
                isPlatformAccount: true,
                platformAccountType: account.type,
            };
            if (profilePictures[account.handle]) {
                updates.profilePictureUrl = profilePictures[account.handle];
            }
            await query.docs[0].ref.update(updates);
            console.log(`✅ Updated @${account.handle}`);
        } else {
            console.warn(`❌ Missing @${account.handle}`);
        }
    }
}

run().then(() => process.exit(0)).catch(console.error);
