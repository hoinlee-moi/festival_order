import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";
import RoleSelectScreen from "../screens/RoleSelectScreen";
import CounterScreen from "../screens/CounterScreen";
import KitchenScreen from "../screens/KitchenScreen";
import PickupScreen from "../screens/PickupScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="RoleSelect"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        <Stack.Screen
          name="Counter"
          component={CounterScreen}
          options={{ title: "카운터" }}
        />
        <Stack.Screen
          name="Kitchen"
          component={KitchenScreen}
          options={{ title: "주방" }}
        />
        <Stack.Screen
          name="Pickup"
          component={PickupScreen}
          options={{ title: "배출구" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
