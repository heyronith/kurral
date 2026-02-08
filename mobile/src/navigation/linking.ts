import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { AppTabParamList } from './AppNavigator';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<AppTabParamList> = {
    prefixes: [prefix, 'kural://'],
    config: {
        screens: {
            HomeStack: {
                screens: {
                    PostDetail: 'post/:postId',
                    TopicDetail: 'topic/:topicName',
                    NewsDetail: 'news/:newsId',
                    Profile: 'profile/:userId',
                },
            },
            NotificationsStack: {
                screens: {
                    NotificationsMain: 'notifications',
                    PostDetail: 'notifications/post/:postId',
                },
            },
            SearchStack: {
                screens: {
                    SearchMain: 'search',
                },
            },
        },
    },
};
