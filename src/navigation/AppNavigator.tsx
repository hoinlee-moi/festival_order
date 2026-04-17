import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";
import RoleSelectScreen from "../screens/RoleSelectScreen";
import CounterScreen from "../screens/CounterScreen";
import KitchenScreen from "../screens/KitchenScreen";
import PickupScreen from "../screens/PickupScreen";
import MenuManageScreen from "../screens/MenuManageScreen";
import SalesDashboardScreen from "../screens/SalesDashboardScreen";

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
        <Stack.Screen
          name="MenuManage"
          component={MenuManageScreen}
          options={{ title: "메뉴 관리" }}
        />
        <Stack.Screen
          name="SalesDashboard"
          component={SalesDashboardScreen}
          options={{ title: "매출 조회" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
