// Mock data generators for development
import type { User, Chirp, Topic, ReachMode } from '../types';

const topics: Topic[] = ['dev', 'startups', 'music', 'sports', 'productivity', 'design', 'politics', 'crypto'];

const mockUsers: Omit<User, 'id' | 'createdAt' | 'following'>[] = [
  { name: 'Maya Ortiz', handle: '@maya' },
  { name: 'Leo Park', handle: '@leo' },
  { name: 'Nia Tran', handle: '@nia' },
  { name: 'Aria Bloom', handle: '@aria' },
  { name: 'Kenji Ito', handle: '@kenji' },
  { name: 'Marlon Rye', handle: '@marlon' },
  { name: 'Priya Sen', handle: '@priya' },
  { name: 'Tasha Lee', handle: '@tasha' },
  { name: 'Diego Sol', handle: '@diego' },
];

const mockTexts: Record<Topic, string[]> = {
  dev: [
    'Cron job finally stopped double-posting updates. Shipping fix in the morning.',
    'Refactoring the auth layer to use JWT tokens. Cleaner than sessions.',
    'Spent 3 hours debugging a race condition. Worth it.',
  ],
  startups: [
    "Reminder: your team isn't a KPI scoreboard. Celebrate small releases.",
    'Running interviews on how people actually tweak their For You slider.',
    'Early stage means saying no to 90% of feature requests.',
  ],
  music: [
    'Late-night guitar loop challenge: 8 bars, no plugins. Go.',
    'New synth patch sounds like a distant memory.',
    'Collaboration session tomorrow. Excited to see what emerges.',
  ],
  sports: [
    'Pickup hoops at 6am keeps the sprint energy calm.',
    'Marathon training week 8. Legs are feeling it.',
    'Watching the game with friends. Nothing beats this.',
  ],
  productivity: [
    'Sketching a distraction-free feed UI for tomorrow\'s release.',
    'What noise can we mute today so the work feels honest again?',
    'Deep work session: 4 hours, zero notifications. Perfect.',
  ],
  design: [
    'Minimalism isn\'t about less. It\'s about the right amount.',
    'Color palette for the new project: muted, intentional.',
    'User testing revealed we were overthinking the flow.',
  ],
  politics: [
    'Politics feed is max volume elsewhere; I keep it muted here to breathe.',
    'Local election results are in. Community engagement up 40%.',
  ],
  crypto: [
    'Muted crypto, boosted dev, my feed feels like a quiet studio again.',
    'Blockchain use cases beyond speculation: supply chain, identity.',
  ],
};

export const generateMockUsers = (): User[] => {
  const now = new Date();
  return mockUsers.map((user, index) => ({
    ...user,
    id: `user-${index + 1}`,
    createdAt: new Date(now.getTime() - (index + 1) * 86400000), // Days ago
    following: [], // Will be set based on relationships
  }));
};

export const generateMockChirps = (users: User[]): Chirp[] => {
  const chirps: Chirp[] = [];
  const now = new Date();
  
  // Create chirps from the last 24 hours
  users.forEach((user, userIndex) => {
    const userTopics = [topics[userIndex % topics.length]];
    const texts = mockTexts[userTopics[0]] || ['Default chirp text'];
    
    // Create 1-3 chirps per user
    const chirpCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < chirpCount; i++) {
      const minutesAgo = Math.floor(Math.random() * 1440); // Last 24 hours
      const createdAt = new Date(now.getTime() - minutesAgo * 60000);
      const reachMode: ReachMode = Math.random() > 0.7 ? 'tuned' : 'forAll';
      
      chirps.push({
        id: `chirp-${userIndex}-${i}`,
        authorId: user.id,
        text: texts[i % texts.length],
        topic: userTopics[0],
        reachMode,
        tunedAudience: reachMode === 'tuned' ? {
          allowFollowers: Math.random() > 0.5,
          allowNonFollowers: Math.random() > 0.5,
        } : undefined,
        createdAt,
        commentCount: Math.floor(Math.random() * 25),
      });
    }
  });
  
  // Set up following relationships (each user follows 2-4 others)
  users.forEach((user) => {
    const followingCount = Math.floor(Math.random() * 3) + 2;
    const following = users
      .filter((u) => u.id !== user.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, followingCount)
      .map((u) => u.id);
    
    user.following = following;
  });
  
  return chirps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

