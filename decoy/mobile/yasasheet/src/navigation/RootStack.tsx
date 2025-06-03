import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { RecommendedScreen } from '../screens/RecommendedScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
                name="Recommended"
                component={RecommendedScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            />
        </Stack.Navigator>
    );
};
