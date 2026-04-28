import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../lib/ThemeContext";

export default function TabLayout() {
    const { theme } = useTheme();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTitleStyle: { color: theme.colors.pageTitle, fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold },
                headerTintColor: theme.colors.text,
                tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.textSecondary,
                headerTitleAlign: 'center',
            }}
        >
            <Tabs.Screen
                name="myjobs"
                options = {{
                    title: "My Jobs",
                    tabBarIcon: ({ color }) => <MaterialIcons name="work" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="tickets"
                options={{
                    title: "Tickets",
                    tabBarIcon: ({ color }) => <MaterialIcons name="receipt" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="notifications"
                options = {{
                    title: "Notifications",
                    tabBarIcon: ({ color }) => <MaterialIcons name="notifications" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name = "more"
                options = {{
                    title: "More",
                    tabBarIcon: ({ color }) => <MaterialIcons name="menu" size={24} color={color} />
                }}
            />
        </Tabs>
    );
}