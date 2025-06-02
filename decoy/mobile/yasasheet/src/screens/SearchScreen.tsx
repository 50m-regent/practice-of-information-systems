import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShadowView } from 'react-native-inner-shadow';
import { Colors } from '../constants/colors';

export const SearchScreen = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const difficulties = Array.from({ length: 9 }, (_, i) => i + 1);
    const genres = ['J-POP', 'J-POP', 'J-POP', 'J-POP', 'J-POP', 'J-POP']; // プレースホルダー

    const recentSearches = ['検索内容検索内容a', '検索内容検索内容b', '検索内容検索内容c'];

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            <View style={styles.searchBox}>
                <View style={styles.searchInputContainer}>
                    <ShadowView
                        inset
                        shadowColor="#00000066"
                        shadowOffset={{ width: 1, height: 1 }}
                        shadowBlur={2}
                        style={styles.searchInputWrapper}
                    >
                        <TextInput
                            style={styles.searchInput}
                            placeholder="曲名・アーティストで検索"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </ShadowView>
                </View>
            </View>

            <ScrollView style={styles.container}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>最近の検索</Text>
                    {recentSearches.map((search, index) => (
                        <View key={index} style={styles.darkShadow}>
                            <TouchableOpacity style={[styles.recentSearchItem, styles.lightShadow]}>
                                <Text>{search}</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>難易度から検索</Text>
                    <View style={styles.difficultyGrid}>
                        {difficulties.map((level) => (
                            <View key={level} style={styles.darkShadow}>
                                <TouchableOpacity
                                    style={[styles.difficultyButton, styles.lightShadow]}
                                >
                                    <Text style={styles.difficultyText}>{level}</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ジャンルから検索</Text>
                    <View style={styles.genreGrid}>
                        {genres.map((genre, index) => (
                            <TouchableOpacity key={index} style={[styles.darkShadow, styles.genreButton]}>
                                <Text style={styles.genreText}>{genre}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    lightShadow: {
        width: '100%',
        shadowColor: 'white',
        shadowOffset: {
            width: -1,
            height: -1,
        },
        shadowOpacity: 1,
        shadowRadius: 2,
    },
    darkShadow: {
        width: '100%',
        shadowColor: Colors.shadow,
        shadowOffset: {
            width: 1,
            height: 1,
        },
        shadowOpacity: 0.4,
        shadowRadius: 2,
    },
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    searchBox: {
        height: 96,
        backgroundColor: Colors.secondary,
        justifyContent: 'flex-end',
    },
    searchInputContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    searchInputWrapper: {
        borderRadius: 24,
        backgroundColor: Colors.background,
    },
    searchInput: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    container: {
        flex: 1,
    },
    section: {
        padding: 16,
        backgroundColor: Colors.background,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: Colors.text,
    },
    recentSearchItem: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 24,
        backgroundColor: Colors.background,
        marginBottom: 12,
    },
    difficultyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    difficultyButton: {
        width: '100%',
        backgroundColor: Colors.accent,
        padding: 8,
        borderRadius: 24,
        marginBottom: 12,
        alignItems: 'center',
    },
    difficultyText: {
        color: Colors.background,
        fontSize: 20,
        fontWeight: '600',
    },
    genreGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    genreButton: {
        width: '48.5%',
        backgroundColor: Colors.background,
        paddingLeft: 16,
        paddingVertical: 16,
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 6,
        borderColor: Colors.primary,
    },
    genreText: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: '600',
    },
});
