import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';

interface SongCardProps {
    title: string;
    artist: string;
    thumbnailUrl?: string;
    onPress?: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({ title, artist, thumbnailUrl, onPress }) => {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <View style={[styles.innerContainer, styles.darkShadow]}>
                <View style={[styles.innerContainer, styles.lightShadow]}>
                    <Image
                        source={
                            thumbnailUrl
                                ? { uri: thumbnailUrl }
                                : require('../assets/default-thumbnail.png')
                        }
                        style={styles.thumbnail}
                    />
                    <LinearGradient colors={Colors.overlayGradient} style={styles.gradient}>
                        <View style={styles.textContainer}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.artist} numberOfLines={1}>
                                {artist}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: '100%',
        backgroundColor: Colors.background,
    },
    innerContainer: {
        height: '100%',
        borderRadius: 8,
        backgroundColor: Colors.background,
        position: 'relative',
    },
    lightShadow: {
        ...Platform.select({
            ios: {
                shadowColor: 'white',
                shadowOffset: {
                    width: -2,
                    height: -2,
                },
                shadowOpacity: 1,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    darkShadow: {
        ...Platform.select({
            ios: {
                shadowColor: Colors.shadow,
                shadowOffset: {
                    width: 2,
                    height: 2,
                },
                shadowOpacity: 0.3,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    thumbnail: {
        height: '100%',
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: Colors.background,
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        overflow: 'hidden',
    },
    textContainer: {
        padding: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.background,
        marginBottom: 2,
    },
    artist: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
