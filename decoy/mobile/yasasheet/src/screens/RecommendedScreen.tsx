import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SongCard } from '../components/SongCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Colors } from '../constants/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const RecommendedScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const sampleSongs = [
        { id: 1, title: 'サンプル曲1', artist: 'サンプルアーティスト1' },
        { id: 2, title: 'サンプル曲2', artist: 'サンプルアーティスト2' },
        { id: 3, title: 'サンプル曲3', artist: 'サンプルアーティスト3' },
        { id: 4, title: 'サンプル曲4', artist: 'サンプルアーティスト4' },
        { id: 5, title: 'サンプル曲5', artist: 'サンプルアーティスト5' },
        { id: 6, title: 'サンプル曲6', artist: 'サンプルアーティスト6' },
        { id: 7, title: 'サンプル曲7', artist: 'サンプルアーティスト7' },
        { id: 8, title: 'サンプル曲8', artist: 'サンプルアーティスト8' },
    ];

    const handleBack = () => {
        navigation.pop();
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={24} color={Colors.background} />
                </TouchableOpacity>
                <Text style={styles.title}>おすすめ</Text>
            </View>
            <ScrollView style={styles.container}>
                <View style={styles.songGrid}>
                    {sampleSongs.map((song) => (
                        <View key={song.id} style={styles.songCardContainer}>
                            <SongCard title={song.title} artist={song.artist} />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 96;
const CARD_MARGIN = 16;
const CARD_WIDTH = (width - 32 - CARD_MARGIN) / 2;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        height: HEADER_HEIGHT,
        backgroundColor: Colors.primary,
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    backButton: {
        width: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.background,
        marginLeft: 8,
    },
    container: {
        flex: 1,
        padding: 16,
    },
    songGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: CARD_MARGIN,
    },
    songCardContainer: {
        width: CARD_WIDTH,
        aspectRatio: 1,
    },
});
