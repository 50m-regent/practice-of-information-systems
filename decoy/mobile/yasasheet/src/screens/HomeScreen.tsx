import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    Linking,
} from 'react-native';
import { SongCard } from '../components/SongCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/types';
import { Colors } from '../constants/colors';
import { spotifyApi } from '../services/api';

type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

export const HomeScreen = () => {
    const rootNavigation = useNavigation<RootNavigationProp>();
    const tabNavigation = useNavigation<TabNavigationProp>();

    React.useEffect(() => {
        const handleUrl = async ({ url }: { url: string }) => {
            if (url.includes('callback')) {
                const code = url.split('code=')[1]?.split('&')[0];
                if (code) {
                    try {
                        const result = await spotifyApi.authenticate(code);
                        console.log('Authentication successful', result);
                        // TODO: アクセストークンをSecure Storeに保存
                    } catch (error) {
                        console.error('Authentication error:', error);
                        Alert.alert('エラー', 'Spotifyとの連携に失敗しました。');
                    }
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleUrl);

        return () => {
            subscription.remove();
        };
    }, []);

    const handleSpotifyAuth = async () => {
        try {
            const authUrl = await spotifyApi.getAuthUrl();
            if (!authUrl) {
                throw new Error('認証URLの取得に失敗しました');
            }

            await Linking.openURL(authUrl);
        } catch (error) {
            console.error('Spotify auth error:', error);
            Alert.alert('エラー', 'Spotifyとの連携中にエラーが発生しました。');
        }
    };

    const sampleSongs = [
        { id: 1, title: 'サンプル曲1', artist: 'サンプルアーティスト1' },
        { id: 2, title: 'サンプル曲2', artist: 'サンプルアーティスト2' },
        { id: 3, title: 'サンプル曲3', artist: 'サンプルアーティスト3' },
        { id: 4, title: 'サンプル曲4', artist: 'サンプルアーティスト4' },
        { id: 5, title: 'サンプル曲5', artist: 'サンプルアーティスト5' },
    ];

    const renderSection = (
        title: string,
        songs: typeof sampleSongs,
        navigateTo?: 'Recommended' | 'Favorite'
    ) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {navigateTo && (
                    <TouchableOpacity
                        onPress={() => {
                            if (navigateTo === 'Favorite') {
                                tabNavigation.navigate(navigateTo);
                            } else {
                                rootNavigation.navigate(navigateTo);
                            }
                        }}
                    >
                        <Text style={styles.viewAllText}>すべて見る</Text>
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.songScrollContainer}
            >
                {songs.map((song) => (
                    <View key={song.id} style={styles.songCardContainer}>
                        <SongCard title={song.title} artist={song.artist} />
                    </View>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.appTitle}>やさシート</Text>
                <TouchableOpacity onPress={handleSpotifyAuth} style={styles.spotifyButton}>
                    <Image
                        source={require('../assets/spotify-icon.png')}
                        style={styles.spotifyIcon}
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.container}>
                {renderSection('クイックアクセス', sampleSongs)}
                {renderSection('お気に入り', sampleSongs, 'Favorite')}
                {renderSection('おすすめ', sampleSongs, 'Recommended')}
            </View>
        </SafeAreaView>
    );
};

const HEADER_HEIGHT = 96;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingBottom: 8,
        height: HEADER_HEIGHT,
    },
    container: {
        flex: 1,
        paddingTop: 16,
        justifyContent: 'space-between',
    },
    appTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.background,
        paddingBottom: 8,
    },
    spotifyButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spotifyIcon: {
        width: '100%',
        height: '100%',
        tintColor: Colors.background,
    },
    section: {
        flex: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    viewAllText: {
        fontSize: 14,
        color: Colors.primary,
    },
    songScrollContainer: {
        paddingTop: 8,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    songCardContainer: {
        marginRight: 16,
        aspectRatio: 1,
        height: '100%',
    },
});
