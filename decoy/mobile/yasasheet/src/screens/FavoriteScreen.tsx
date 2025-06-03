import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SongCard } from '../components/SongCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

export const FavoriteScreen = () => {
    const sampleSongs = [
        { id: 1, title: 'サンプル曲1', artist: 'サンプルアーティスト1' },
        { id: 2, title: 'サンプル曲2', artist: 'サンプルアーティスト2' },
        { id: 3, title: 'サンプル曲3', artist: 'サンプルアーティスト3' },
        { id: 4, title: 'サンプル曲4', artist: 'サンプルアーティスト4' },
        { id: 5, title: 'サンプル曲5', artist: 'サンプルアーティスト5' },
        { id: 6, title: 'サンプル曲6', artist: 'サンプルアーティスト6' },
        { id: 7, title: 'サンプル曲7', artist: 'サンプルアーティスト7' },
    ];

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.title}>お気に入りの楽曲</Text>
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
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.background,
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
