// Mock vector icons
jest.mock('@expo/vector-icons', () => {
  const MockIcon = () => null;

  return {
    MaterialIcons: MockIcon,
    Ionicons: MockIcon,
    FontAwesome: MockIcon,
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock')
);

// Mock expo-location (virtual module)
jest.mock(
  'expo-location',
  () => ({
    requestForegroundPermissionsAsync: jest.fn(async () => ({
      status: 'granted',
    })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: {
        latitude: 0,
        longitude: 0,
      },
    })),
    watchPositionAsync: jest.fn(),
  }),
  { virtual: true }
);

// Mock expo-task-manager
jest.mock(
  'expo-task-manager',
  () => ({
    defineTask: jest.fn(),
  }),
  { virtual: true }
);

// Mock expo-secure-store
jest.mock(
  'expo-secure-store',
  () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  }),
  { virtual: true }
);